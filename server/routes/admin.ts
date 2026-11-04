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
import { broadcastChannelsUpdate, getOnlinePlayersList } from '../ws.ts';
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

// 1.1 Get pending users specifically
adminRouter.get('/pending-users', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = loadDB();
  const pendingUsers = db.users
    .filter((u) => u.status === 'pending')
    .map((u) => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      game_id: u.game_id,
      phone: u.phone,
      role: u.role,
      status: u.status,
      created_at: u.created_at,
    }));

  res.json({
    count: pendingUsers.length,
    users: pendingUsers,
  });
});

// 1.2 Batch approve pending users
adminRouter.post('/users/batch-approve', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { userIds } = req.body || {};
  const db = loadDB();
  const now = new Date().toISOString();
  let approvedCount = 0;

  db.users.forEach((u) => {
    if (u.status === 'pending') {
      if (!userIds || (Array.isArray(userIds) && userIds.includes(u.id))) {
        u.status = 'active';
        u.updated_at = now;
        approvedCount++;
        logOperation({
          user_id: admin.id,
          username: admin.username,
          action: 'USER_APPROVE',
          new_data: { target_id: u.id, target_username: u.username, target_game_id: u.game_id },
        });
      }
    }
  });

  if (approvedCount > 0) {
    scheduleSave();
  }

  res.json({
    success: true,
    approvedCount,
    message: `成功审核通过 ${approvedCount} 个账号！`,
  });
});

// 1.3 Get currently online players (Admin only)
adminRouter.get('/online-players', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const onlineList = getOnlinePlayersList();
  res.json({
    totalCount: onlineList.length,
    users: onlineList,
  });
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

// Helper for Beijing Time parts
function getBeijingDateParts(d: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year,
    month,
    day,
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
    label: `${pad(month)}-${pad(day)}`,
    monthKey: `${year}-${pad(month)}`,
    monthLabel: `${month}月`,
    yearMonth: `${year}年${month}月`,
  };
}

function getBeijingWeekInfo(d: Date) {
  const beijingParts = getBeijingDateParts(d);
  const target = new Date(`${beijingParts.dateKey}T12:00:00+08:00`);
  const dayNr = (target.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  
  // Calculate ISO week number
  const thurs = new Date(target);
  thurs.setDate(target.getDate() - dayNr + 3);
  const firstJan = new Date(thurs.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((thurs.getTime() - firstJan.getTime()) / 86400000 - 3 + ((firstJan.getDay() + 6) % 7)) / 7);
  const weekPad = String(Math.max(1, weekNum)).padStart(2, '0');

  // Calculate Monday and Sunday of this week
  const mon = new Date(target);
  mon.setDate(target.getDate() - dayNr);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const monParts = getBeijingDateParts(mon);
  const sunParts = getBeijingDateParts(sun);
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    weekKey: `${beijingParts.year}-W${weekPad}`,
    weekLabel: `第${weekNum}周`,
    dateRange: `${pad(monParts.month)}/${pad(monParts.day)}-${pad(sunParts.month)}/${pad(sunParts.day)}`,
  };
}

const STAT_PALETTE = [
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#eab308', // yellow-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
];

// 13. Admin Kill Statistics: 每日，每周，每月，每个人的击杀总数，条形图与饼状图数据
adminRouter.get('/kill-stats', (req: Request, res: Response) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = loadDB();
  const validKills = db.kill_records.filter((r) => !r.is_void);
  const totalKills = validKills.length;

  const now = new Date();
  const todayParts = getBeijingDateParts(now);
  const todayDateKey = todayParts.dateKey;
  const thisMonthKey = todayParts.monthKey;
  const currentWeekInfo = getBeijingWeekInfo(now);
  const thisWeekKey = currentWeekInfo.weekKey;

  // Yesterday
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getBeijingDateParts(yesterdayDate).dateKey;

  // Last Week
  const lastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekKey = getBeijingWeekInfo(lastWeekDate).weekKey;

  // Last Month
  const lastMonthDate = new Date(todayParts.year, todayParts.month - 2, 1);
  const lastMonthKey = getBeijingDateParts(lastMonthDate).monthKey;

  // Daily map initialization: past 14 days
  const dailyStatsMap = new Map<string, { date: string; label: string; count: number; isToday: boolean }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const p = getBeijingDateParts(d);
    dailyStatsMap.set(p.dateKey, {
      date: p.dateKey,
      label: p.label,
      count: 0,
      isToday: p.dateKey === todayDateKey,
    });
  }

  // Weekly map initialization: past 8 weeks
  const weeklyStatsMap = new Map<string, { week: string; label: string; dateRange: string; count: number; isCurrentWeek: boolean }>();
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const wInfo = getBeijingWeekInfo(d);
    if (!weeklyStatsMap.has(wInfo.weekKey)) {
      weeklyStatsMap.set(wInfo.weekKey, {
        week: wInfo.weekKey,
        label: wInfo.weekLabel,
        dateRange: wInfo.dateRange,
        count: 0,
        isCurrentWeek: wInfo.weekKey === thisWeekKey,
      });
    }
  }

  // Monthly map initialization: past 6 months
  const monthlyStatsMap = new Map<string, { month: string; label: string; yearMonth: string; count: number; isCurrentMonth: boolean }>();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(todayParts.year, todayParts.month - 1 - m, 1);
    const mParts = getBeijingDateParts(d);
    monthlyStatsMap.set(mParts.monthKey, {
      month: mParts.monthKey,
      label: mParts.monthLabel,
      yearMonth: mParts.yearMonth,
      count: 0,
      isCurrentMonth: mParts.monthKey === thisMonthKey,
    });
  }

  // User Map for rich profiles
  const userMap = new Map<string, User>();
  for (const u of db.users) {
    userMap.set(u.id, u);
    userMap.set(u.username, u);
  }

  // Member accumulator
  const memberMap = new Map<string, {
    user_id?: string;
    game_id: string;
    username: string;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    totalCount: number;
    lastKilledAt?: string;
    lastChannelNo?: number;
  }>();

  let todayKills = 0;
  let yesterdayKills = 0;
  let thisWeekKills = 0;
  let lastWeekKills = 0;
  let thisMonthKills = 0;
  let lastMonthKills = 0;

  // Process all valid kills
  for (const record of validKills) {
    const kDate = new Date(record.killed_at);
    const kParts = getBeijingDateParts(kDate);
    const kWInfo = getBeijingWeekInfo(kDate);

    // 1. Daily
    if (dailyStatsMap.has(kParts.dateKey)) {
      dailyStatsMap.get(kParts.dateKey)!.count += 1;
    }
    if (kParts.dateKey === todayDateKey) {
      todayKills += 1;
    } else if (kParts.dateKey === yesterdayKey) {
      yesterdayKills += 1;
    }

    // 2. Weekly
    if (weeklyStatsMap.has(kWInfo.weekKey)) {
      weeklyStatsMap.get(kWInfo.weekKey)!.count += 1;
    }
    if (kWInfo.weekKey === thisWeekKey) {
      thisWeekKills += 1;
    } else if (kWInfo.weekKey === lastWeekKey) {
      lastWeekKills += 1;
    }

    // 3. Monthly
    if (monthlyStatsMap.has(kParts.monthKey)) {
      monthlyStatsMap.get(kParts.monthKey)!.count += 1;
    }
    if (kParts.monthKey === thisMonthKey) {
      thisMonthKills += 1;
    } else if (kParts.monthKey === lastMonthKey) {
      lastMonthKills += 1;
    }

    // 4. Per person / character
    const charName = (record.game_id || record.created_by || '神秘玩家').trim();
    let mem = memberMap.get(charName);
    if (!mem) {
      const u = record.created_by_user_id ? userMap.get(record.created_by_user_id) : userMap.get(record.created_by);
      mem = {
        user_id: record.created_by_user_id || u?.id,
        game_id: charName,
        username: u?.username || record.created_by || charName,
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        totalCount: 0,
      };
      memberMap.set(charName, mem);
    }

    mem.totalCount += 1;
    if (kParts.dateKey === todayDateKey) mem.todayCount += 1;
    if (kWInfo.weekKey === thisWeekKey) mem.weekCount += 1;
    if (kParts.monthKey === thisMonthKey) mem.monthCount += 1;

    if (!mem.lastKilledAt || new Date(record.killed_at).getTime() > new Date(mem.lastKilledAt).getTime()) {
      mem.lastKilledAt = record.killed_at;
      mem.lastChannelNo = record.channel_no;
    }
  }

  // Convert member stats array and sort by total kills desc
  const memberStatsList = Array.from(memberMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  const memberStats = memberStatsList.map((m, idx) => {
    const percentage = totalKills > 0 ? Math.round((m.totalCount / totalKills) * 1000) / 10 : 0;
    const color = STAT_PALETTE[idx % STAT_PALETTE.length];
    return {
      ...m,
      percentage,
      color,
    };
  });

  // Pie chart role share data: top roles + others if too many
  const roleShare = memberStats.map((m) => ({
    game_id: m.game_id,
    username: m.username,
    count: m.totalCount,
    percentage: m.percentage,
    color: m.color,
  }));

  const payload = {
    totalKills,
    todayKills,
    yesterdayKills,
    thisWeekKills,
    lastWeekKills,
    thisMonthKills,
    lastMonthKills,
    uniqueKillersCount: memberStats.length,
    dailyStats: Array.from(dailyStatsMap.values()),
    weeklyStats: Array.from(weeklyStatsMap.values()),
    monthlyStats: Array.from(monthlyStatsMap.values()),
    roleShare,
    memberStats,
  };

  res.json(payload);
});


