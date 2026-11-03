import { Router, Request, Response } from 'express';
import {
  loadDB,
  scheduleSave,
  getAllChannelsComputed,
  computeChannelStatus,
  logOperation,
} from '../db.ts';
import { broadcastChannelsUpdate } from '../ws.ts';
import { KillRecord, User } from '../types.ts';

export const channelsRouter = Router();

// Middleware to extract user from Authorization header
function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const token = authHeader.replace(/^Bearer\s+/, '');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const db = loadDB();
    const user = db.users.find((u) => u.id === decoded.userId);
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
}

// 1. Get all computed channels
channelsRouter.get('/', (req: Request, res: Response) => {
  const now = new Date();
  const db = loadDB();
  const channels = getAllChannelsComputed(now);
  res.json({
    serverTime: now.toISOString(),
    boss: db.boss,
    settings: db.settings,
    channels,
  });
});

// 2. Visit a channel
channelsRouter.post('/:channelNo/visit', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  if (isNaN(channelNo) || channelNo < 1 || channelNo > 60) {
    return res.status(400).json({ error: '无效的频道编号' });
  }

  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '必须登录且账号处于已启用状态方可访问频道' });
  }

  const db = loadDB();
  const now = new Date().toISOString();

  // Rule 4.3: If user is visiting another channel, automatically leave that channel first
  let leftOtherChannel: number | null = null;
  for (const visit of db.channel_visits) {
    if (visit.user_id === user.id && visit.status === 'active' && visit.channel_no !== channelNo) {
      visit.status = 'left';
      visit.left_at = now;
      leftOtherChannel = visit.channel_no;
    }
  }

  // Check if already active in this channel
  const existingActive = db.channel_visits.find(
    (v) => v.channel_no === channelNo && v.user_id === user.id && v.status === 'active'
  );

  if (existingActive) {
    existingActive.last_heartbeat_at = now;
    existingActive.game_id = user.game_id; // Sync latest game ID
  } else {
    // Add new active visit
    db.channel_visits.push({
      id: `visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channel_no: channelNo,
      user_id: user.id,
      game_id: user.game_id,
      username: user.username,
      joined_at: now,
      last_heartbeat_at: now,
      status: 'active',
    });
  }

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    action: 'CHANNEL_VISIT',
    new_data: { channelNo, game_id: user.game_id, leftOtherChannel },
  });

  broadcastChannelsUpdate();

  const channelObj = db.channels.find((c) => c.channel_no === channelNo);
  const updatedView = channelObj ? computeChannelStatus(channelObj, new Date()) : null;

  return res.json({
    success: true,
    channel: updatedView,
    leftOtherChannel,
  });
});

// 3. Leave a channel
channelsRouter.post('/:channelNo/leave', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '未登录' });
  }

  const db = loadDB();
  const now = new Date().toISOString();
  let leftAny = false;

  for (const visit of db.channel_visits) {
    if (visit.channel_no === channelNo && visit.user_id === user.id && visit.status === 'active') {
      visit.status = 'left';
      visit.left_at = now;
      leftAny = true;
    }
  }

  if (leftAny) {
    scheduleSave();
    logOperation({
      user_id: user.id,
      username: user.username,
      channel_no: channelNo,
      action: 'CHANNEL_LEAVE',
    });
    broadcastChannelsUpdate();
  }

  return res.json({ success: true });
});

// 4. Record a Kill (Section 4.4 & 4.5 Concurrency handling)
channelsRouter.post('/:channelNo/kill', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '必须登录才能提交击杀' });
  }

  const db = loadDB();

  // Strict backend validation: user must be actively visiting this channel!
  const isVisiting = db.channel_visits.some(
    (v) => v.channel_no === channelNo && v.user_id === user.id && v.status === 'active'
  );

  if (!isVisiting) {
    return res.status(403).json({
      error: '只有当前正在访问该频道的玩家才能点击击杀！请先点击“访问”按钮加入该频道。',
    });
  }

  const serverNow = new Date();
  const serverNowIso = serverNow.toISOString();
  const serverNowMs = serverNow.getTime();

  const entryMs = serverNowMs + db.boss.entry_interval * 60 * 1000;
  const guaranteedMs = serverNowMs + db.boss.guaranteed_interval * 60 * 1000;
  const entryIso = new Date(entryMs).toISOString();
  const guaranteedIso = new Date(guaranteedMs).toISOString();

  // Concurrency check (Section 4.5):
  // Check if there is already an active kill record created within the last 60 seconds
  // for this same channel round. If so, treat as concurrent multi-player clicks:
  // update the record with this latest click timestamp and record all clicks in operation log.
  const activeKills = db.kill_records.filter(
    (k) => k.channel_no === channelNo && !k.is_void
  );
  activeKills.sort((a, b) => new Date(b.killed_at).getTime() - new Date(a.killed_at).getTime());
  const latestKill = activeKills[0];

  let record: KillRecord;
  let isConcurrentUpdate = false;

  const CONCURRENCY_WINDOW_MS = 60 * 1000; // 60 seconds concurrent window
  const isRecentConcurrent =
    latestKill &&
    serverNowMs - new Date(latestKill.killed_at).getTime() >= 0 &&
    serverNowMs - new Date(latestKill.killed_at).getTime() < CONCURRENCY_WINDOW_MS;

  if (isRecentConcurrent && latestKill) {
    // Treat as multi-player concurrent click for same round!
    isConcurrentUpdate = true;
    const oldKilledAt = latestKill.killed_at;
    latestKill.killed_at = serverNowIso;
    latestKill.entry_at = entryIso;
    latestKill.guaranteed_at = guaranteedIso;
    latestKill.updated_at = serverNowIso;
    latestKill.updated_by = user.username;
    record = latestKill;

    logOperation({
      user_id: user.id,
      username: user.username,
      channel_no: channelNo,
      record_id: record.id,
      action: 'CONCURRENT_KILL_CLICK',
      old_data: { killed_at: oldKilledAt },
      new_data: {
        killed_at: serverNowIso,
        click_by: user.username,
        game_id: user.game_id,
        note: '同一轮多人击杀并发点击，已按最后一次有效点击服务器时间更新该轮击杀时间',
      },
    });
  } else {
    record = {
      id: `kill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channel_no: channelNo,
      boss_name: db.boss.boss_name,
      killed_at: serverNowIso,
      entry_at: entryIso,
      guaranteed_at: guaranteedIso,
      game_id: user.game_id,
      kill_note: (req.body.kill_note || '').trim(),
      created_by: user.username,
      created_by_user_id: user.id,
      created_at: serverNowIso,
      updated_at: serverNowIso,
      is_void: false,
    };
    db.kill_records.push(record);

    logOperation({
      user_id: user.id,
      username: user.username,
      channel_no: channelNo,
      record_id: record.id,
      action: 'KILL_RECORD_CREATE',
      new_data: {
        killed_at: serverNowIso,
        game_id: user.game_id,
        entry_at: entryIso,
        guaranteed_at: guaranteedIso,
      },
    });
  }

  // Update channel version
  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (channel) {
    channel.version += 1;
    channel.updated_at = serverNowIso;
    channel.updated_by = user.username;
  }

  scheduleSave();
  broadcastChannelsUpdate();

  const channelView = channel ? computeChannelStatus(channel, serverNow) : null;

  return res.json({
    success: true,
    isConcurrentUpdate,
    record,
    channel: channelView,
    message: isConcurrentUpdate
      ? '检测到多人同时击杀，已按最后一次有效点击的服务器时间更新此轮击杀时间！'
      : '击杀记录提交成功！进刷与保底时间已自动计算。',
  });
});

// 5. Get channel kill history
channelsRouter.get('/:channelNo/history', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const db = loadDB();
  const records = db.kill_records
    .filter((k) => k.channel_no === channelNo)
    .sort((a, b) => new Date(b.killed_at).getTime() - new Date(a.killed_at).getTime());

  const channel = db.channels.find((c) => c.channel_no === channelNo);

  return res.json({
    channelNo,
    channelNote: channel?.channel_note || '',
    records,
  });
});

// 6. Manual backfill (Section 6.2)
channelsRouter.post('/:channelNo/backfill', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '必须登录后才能补录击杀记录' });
  }

  const { killed_at, game_id, kill_note } = req.body;
  if (!killed_at) {
    return res.status(400).json({ error: '请选择实际击杀时间' });
  }

  const killedDate = new Date(killed_at);
  if (isNaN(killedDate.getTime())) {
    return res.status(400).json({ error: '击杀时间格式无效' });
  }

  const db = loadDB();
  const now = new Date().toISOString();
  const entryMs = killedDate.getTime() + db.boss.entry_interval * 60 * 1000;
  const guaranteedMs = killedDate.getTime() + db.boss.guaranteed_interval * 60 * 1000;

  const record: KillRecord = {
    id: `kill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    channel_no: channelNo,
    boss_name: db.boss.boss_name,
    killed_at: killedDate.toISOString(),
    entry_at: new Date(entryMs).toISOString(),
    guaranteed_at: new Date(guaranteedMs).toISOString(),
    game_id: (game_id || user.game_id).trim(),
    kill_note: (kill_note || '').trim(),
    created_by: user.username,
    created_by_user_id: user.id,
    created_at: now,
    updated_at: now,
    is_void: false,
  };

  db.kill_records.push(record);

  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (channel) {
    channel.version += 1;
    channel.updated_at = now;
    channel.updated_by = user.username;
  }

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    record_id: record.id,
    action: 'KILL_RECORD_BACKFILL',
    new_data: {
      killed_at: record.killed_at,
      game_id: record.game_id,
      kill_note: record.kill_note,
    },
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, record });
});

// 7. Edit Kill Record (Section 6.3 - ordinary players can edit game_id, killed_at, kill_note)
channelsRouter.put('/:channelNo/records/:recordId', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const { recordId } = req.params;
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '未登录' });
  }

  const { killed_at, game_id, kill_note } = req.body;
  const db = loadDB();
  const record = db.kill_records.find((k) => k.id === recordId && k.channel_no === channelNo);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const oldData = {
    killed_at: record.killed_at,
    game_id: record.game_id,
    kill_note: record.kill_note,
  };

  if (killed_at) {
    const killedDate = new Date(killed_at);
    if (!isNaN(killedDate.getTime())) {
      record.killed_at = killedDate.toISOString();
      const entryMs = killedDate.getTime() + db.boss.entry_interval * 60 * 1000;
      const guaranteedMs = killedDate.getTime() + db.boss.guaranteed_interval * 60 * 1000;
      record.entry_at = new Date(entryMs).toISOString();
      record.guaranteed_at = new Date(guaranteedMs).toISOString();
    }
  }

  if (game_id !== undefined) {
    record.game_id = game_id.trim();
  }
  if (kill_note !== undefined) {
    record.kill_note = kill_note.trim();
  }

  const now = new Date().toISOString();
  record.updated_at = now;
  record.updated_by = user.username;

  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (channel) {
    channel.version += 1;
    channel.updated_at = now;
  }

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    record_id: record.id,
    action: 'KILL_RECORD_EDIT',
    old_data: oldData,
    new_data: {
      killed_at: record.killed_at,
      game_id: record.game_id,
      kill_note: record.kill_note,
    },
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, record });
});

// 8. Void Kill Record (Section 6.4)
channelsRouter.post('/:channelNo/records/:recordId/void', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const { recordId } = req.params;
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '未登录' });
  }

  const { void_reason } = req.body;
  const db = loadDB();
  const record = db.kill_records.find((k) => k.id === recordId && k.channel_no === channelNo);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.is_void) {
    return res.status(400).json({ error: '该记录已处于撤销状态' });
  }

  const now = new Date().toISOString();
  record.is_void = true;
  record.voided_by = user.username;
  record.voided_at = now;
  record.void_reason = (void_reason || '未填写撤销原因').trim();
  record.updated_at = now;
  record.updated_by = user.username;

  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (channel) {
    channel.version += 1;
    channel.updated_at = now;
  }

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    record_id: record.id,
    action: 'KILL_RECORD_VOID',
    new_data: { void_reason: record.void_reason, voided_by: user.username },
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, record });
});

// 9. Restore Voided Kill Record (Section 6.4 - Admin ONLY)
channelsRouter.post('/:channelNo/records/:recordId/restore', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const { recordId } = req.params;
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员才可以恢复已撤销的击杀记录' });
  }

  const db = loadDB();
  const record = db.kill_records.find((k) => k.id === recordId && k.channel_no === channelNo);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (!record.is_void) {
    return res.status(400).json({ error: '该记录未被撤销' });
  }

  const now = new Date().toISOString();
  record.is_void = false;
  record.updated_at = now;
  record.updated_by = user.username;

  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (channel) {
    channel.version += 1;
    channel.updated_at = now;
  }

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    record_id: record.id,
    action: 'KILL_RECORD_RESTORE',
    new_data: { restored_by: user.username },
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, record });
});

// 10. Update Channel Long-term Note (Section 5.2 - Admin ONLY)
channelsRouter.put('/:channelNo/note', (req: Request, res: Response) => {
  const channelNo = parseInt(req.params.channelNo, 10);
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以修改频道长期备注' });
  }

  const { channel_note } = req.body;
  const db = loadDB();
  const channel = db.channels.find((c) => c.channel_no === channelNo);
  if (!channel) {
    return res.status(404).json({ error: '频道不存在' });
  }

  const oldNote = channel.channel_note;
  channel.channel_note = (channel_note || '').trim();
  channel.version += 1;
  channel.updated_at = new Date().toISOString();
  channel.updated_by = user.username;

  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    channel_no: channelNo,
    action: 'CHANNEL_NOTE_UPDATE',
    old_data: { note: oldNote },
    new_data: { note: channel.channel_note },
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, channel });
});
