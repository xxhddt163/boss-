import { Router, Request, Response } from 'express';
import {
  loadDB,
  scheduleSave,
  saveDBImmediate,
  logOperation,
  createBackup,
  listBackups,
  restoreBackup,
  resetToCleanState,
} from '../db.ts';
import { broadcastChannelsUpdate } from '../ws.ts';
import { User, KillRecord } from '../types.ts';

export const adminRouter = Router();

// Middleware: admin check
function requireAdmin(req: Request, res: Response): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: '未登录' });
    return null;
  }
  try {
    const token = authHeader.replace(/^Bearer\s+/, '');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const db = loadDB();
    const user = db.users.find((u) => u.id === decoded.userId);

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: '用户未登录或未启用' });
      return null;
    }

    if (user.role !== 'admin') {
      res.status(403).json({ error: '需要管理员权限' });
      return null;
    }

    return user;
  } catch {
    res.status(401).json({ error: '凭证无效' });
    return null;
  }
}

// 1. Get all users
adminRouter.get('/users', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = loadDB();
  const safeUsers = db.users.map((u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    game_id: u.game_id,
    phone: u.phone,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  }));

  res.json({ users: safeUsers });
});

// 2. Change user status (approve / disable)
adminRouter.post('/users/:userId/status', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { userId } = req.params;
  const { status } = req.body; // 'active' | 'disabled' | 'pending'

  if (!['active', 'disabled', 'pending'].includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  const db = loadDB();
  const targetUser = db.users.find((u) => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (targetUser.username === 'admin' && status !== 'active') {
    return res.status(400).json({ error: '不可禁用默认超级管理员账号' });
  }

  const oldStatus = targetUser.status;
  targetUser.status = status;
  targetUser.updated_at = new Date().toISOString();

  // If disabled, also remove from active channel visits
  if (status === 'disabled') {
    for (const v of db.channel_visits) {
      if (v.user_id === targetUser.id && v.status === 'active') {
        v.status = 'left';
        v.left_at = new Date().toISOString();
      }
    }
    broadcastChannelsUpdate();
  }

  scheduleSave();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_USER_STATUS_CHANGE',
    old_data: { userId, username: targetUser.username, status: oldStatus },
    new_data: { status },
  });

  return res.json({ success: true, user: targetUser });
});

// 3. Update user profile
adminRouter.put('/users/:userId', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { userId } = req.params;
  const { game_id, nickname, role, phone } = req.body;

  const db = loadDB();
  const targetUser = db.users.find((u) => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const oldData = {
    game_id: targetUser.game_id,
    nickname: targetUser.nickname,
    role: targetUser.role,
    phone: targetUser.phone,
  };

  if (game_id !== undefined) targetUser.game_id = game_id.trim();
  if (nickname !== undefined) targetUser.nickname = nickname.trim();
  if (phone !== undefined) targetUser.phone = phone.trim();
  if (role && ['admin', 'player'].includes(role)) {
    if (targetUser.username === 'admin' && role !== 'admin') {
      return res.status(400).json({ error: '默认超级管理员角色不可更改' });
    }
    targetUser.role = role;
  }

  targetUser.updated_at = new Date().toISOString();
  scheduleSave();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_USER_PROFILE_UPDATE',
    old_data: oldData,
    new_data: {
      game_id: targetUser.game_id,
      nickname: targetUser.nickname,
      role: targetUser.role,
      phone: targetUser.phone,
    },
  });

  return res.json({ success: true, user: targetUser });
});

// 4. Update Boss spawn rules
adminRouter.put('/boss', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { entry_interval, guaranteed_interval, boss_name } = req.body;
  const db = loadDB();

  const entry = parseInt(entry_interval, 10);
  const guaranteed = parseInt(guaranteed_interval, 10);

  if (isNaN(entry) || entry <= 0 || isNaN(guaranteed) || guaranteed <= entry) {
    return res.status(400).json({
      error: '进刷时间与保底时间必须为正整数，且保底时间必须大于进刷时间',
    });
  }

  const oldBoss = { ...db.boss };
  db.boss.entry_interval = entry;
  db.boss.guaranteed_interval = guaranteed;
  if (boss_name) db.boss.boss_name = boss_name.trim();
  db.boss.updated_at = new Date().toISOString();
  db.boss.updated_by = admin.username;

  // Recalculate spawn times for all active kill records
  for (const record of db.kill_records) {
    if (!record.is_void) {
      const killedMs = new Date(record.killed_at).getTime();
      record.entry_at = new Date(killedMs + entry * 60 * 1000).toISOString();
      record.guaranteed_at = new Date(killedMs + guaranteed * 60 * 1000).toISOString();
    }
  }

  scheduleSave();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_BOSS_CONFIG_UPDATE',
    old_data: oldBoss,
    new_data: db.boss,
  });

  broadcastChannelsUpdate();

  return res.json({ success: true, boss: db.boss });
});

// 5. Audit logs
adminRouter.get('/logs', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = loadDB();
  const { action, username, channel_no, limit } = req.query;

  let filtered = db.operation_logs;

  if (action) {
    filtered = filtered.filter((l) => l.action.toLowerCase().includes(String(action).toLowerCase()));
  }
  if (username) {
    filtered = filtered.filter((l) => l.username.toLowerCase().includes(String(username).toLowerCase()));
  }
  if (channel_no) {
    filtered = filtered.filter((l) => l.channel_no === parseInt(String(channel_no), 10));
  }

  const max = limit ? parseInt(String(limit), 10) : 100;
  res.json({ logs: filtered.slice(0, max) });
});

// 6. Update system settings
adminRouter.put('/settings', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { reminder_before, sound_enabled, notification_enabled } = req.body;
  const db = loadDB();

  if (reminder_before !== undefined) {
    const val = parseInt(reminder_before, 10);
    if (!isNaN(val) && val > 0 && val <= 30) {
      db.settings.reminder_before = val;
    }
  }

  if (sound_enabled !== undefined) db.settings.sound_enabled = !!sound_enabled;
  if (notification_enabled !== undefined) db.settings.notification_enabled = !!notification_enabled;
  db.settings.updated_at = new Date().toISOString();
  db.settings.updated_by = admin.username;

  scheduleSave();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_SETTINGS_UPDATE',
    new_data: db.settings,
  });

  return res.json({ success: true, settings: db.settings });
});

// 7. Export full database
adminRouter.get('/export', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = loadDB();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="snowman_tracker_export_${Date.now()}.json"`
  );
  res.send(JSON.stringify(db, null, 2));
});

// 8. Import database
adminRouter.post('/import', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { data } = req.body;
  if (!data || !data.channels || !data.users) {
    return res.status(400).json({ error: '无效的数据备份文件格式' });
  }

  // Backup current state first
  createBackup('pre_import');

  const db = loadDB();
  db.boss = data.boss || db.boss;
  db.channels = data.channels;
  db.kill_records = data.kill_records || [];
  db.channel_visits = data.channel_visits || [];
  db.settings = data.settings || db.settings;
  // Merge users, ensure admin exists
  const existingUsernames = new Set(data.users.map((u: any) => u.username));
  if (!existingUsernames.has('admin')) {
    data.users.push(db.users.find((u) => u.username === 'admin'));
  }
  db.users = data.users;

  saveDBImmediate();
  broadcastChannelsUpdate();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_DATABASE_IMPORT',
    new_data: { recordsCount: db.kill_records.length, usersCount: db.users.length },
  });

  return res.json({ success: true, message: '数据导入成功' });
});

// 9. Backups list
adminRouter.get('/backups', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const backups = listBackups();
  res.json({ backups });
});

// 10. Manual backup trigger
adminRouter.post('/backups/create', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const filename = createBackup('manual');
  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_BACKUP_CREATE',
    new_data: { filename },
  });

  res.json({ success: true, filename });
});

// 11. Restore backup
adminRouter.post('/backups/restore', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: '缺少文件名' });

  // Create safety snapshot before restore
  createBackup('pre_restore');

  const success = restoreBackup(filename);
  if (!success) {
    return res.status(500).json({ error: '备份还原失败，文件可能不存在或已损坏' });
  }

  broadcastChannelsUpdate();

  logOperation({
    user_id: admin.id,
    username: admin.username,
    action: 'ADMIN_BACKUP_RESTORE',
    new_data: { restoredFile: filename },
  });

  res.json({ success: true, message: '备份还原成功' });
});

// 12. Reset database to completely blank / clean state
adminRouter.post('/reset-database', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  resetToCleanState();
  broadcastChannelsUpdate();

  res.json({ success: true, message: '系统数据库已重置为全新空白状态！所有击杀与访问数据已清空。' });
});

