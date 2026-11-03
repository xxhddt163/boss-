import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  DBState,
  User,
  BossConfig,
  Channel,
  KillRecord,
  ChannelVisit,
  OperationLog,
  SystemSettings,
  ChannelComputedView,
  ChannelStatus,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let dbState: DBState | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function getInitialState(): DBState {
  const adminPasswordHash = bcrypt.hashSync('admin', 10);
  const now = new Date().toISOString();

  const adminUser: User = {
    id: 'user_admin_001',
    username: 'admin',
    password_hash: adminPasswordHash,
    nickname: '系统管理员',
    game_id: 'GM管理员',
    phone: '13800000000',
    role: 'admin',
    status: 'active',
    must_change_password: true,
    created_at: now,
    updated_at: now,
  };

  const boss: BossConfig = {
    id: 'boss_snowman_01',
    boss_name: '驮狼雪人',
    entry_interval: 60,
    guaranteed_interval: 90,
    enabled: true,
    updated_at: now,
    updated_by: 'system',
  };

  const channels: Channel[] = [];
  for (let i = 1; i <= 60; i++) {
    channels.push({
      id: `ch_${i}`,
      channel_no: i,
      boss_id: boss.id,
      channel_note: '',
      channel_tag: '',
      version: 1,
      updated_at: now,
      updated_by: 'system',
    });
  }

  const settings: SystemSettings = {
    timezone: 'Asia/Shanghai',
    reminder_before: 5,
    sound_enabled: true,
    notification_enabled: true,
    updated_at: now,
    updated_by: 'system',
  };

  return {
    users: [adminUser],
    boss,
    channels,
    kill_records: [],
    channel_visits: [],
    operation_logs: [],
    settings,
  };
}

export function loadDB(): DBState {
  if (dbState) return dbState;

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content) as DBState;

      // Ensure 60 channels exist
      if (!parsed.channels || parsed.channels.length < 60) {
        const existing = new Set((parsed.channels || []).map((c) => c.channel_no));
        const now = new Date().toISOString();
        parsed.channels = parsed.channels || [];
        for (let i = 1; i <= 60; i++) {
          if (!existing.has(i)) {
            parsed.channels.push({
              id: `ch_${i}`,
              channel_no: i,
              boss_id: parsed.boss?.id || 'boss_snowman_01',
              channel_note: '',
              version: 1,
              updated_at: now,
              updated_by: 'system',
            });
          }
        }
        parsed.channels.sort((a, b) => a.channel_no - b.channel_no);
      }

      if (!parsed.boss) {
        parsed.boss = {
          id: 'boss_snowman_01',
          boss_name: '驮狼雪人',
          entry_interval: 60,
          guaranteed_interval: 90,
          enabled: true,
          updated_at: new Date().toISOString(),
          updated_by: 'system',
        };
      }

      dbState = parsed;
      return dbState;
    } catch (err) {
      console.error('Failed to parse db.json, creating new database', err);
    }
  }

  dbState = getInitialState();
  saveDBImmediate();
  return dbState;
}

export function resetToCleanState(): void {
  dbState = getInitialState();
  saveDBImmediate();
}

export function saveDBImmediate(): void {
  if (!dbState) return;
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (e) {
    console.error('Error writing db file', e);
  }
}

export function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDBImmediate();
  }, 100);
}

// Helpers for dates in Beijing Time (Asia/Shanghai, UTC+8)
export function formatShanghai(isoString: string | null | undefined): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--';
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(d).replace(/\//g, '-');
  } catch {
    return '--';
  }
}

// Format seconds into HH:MM:SS
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function getLatestValidKill(channelNo: number): KillRecord | null {
  const db = loadDB();
  const validKills = db.kill_records.filter(
    (k) => k.channel_no === channelNo && !k.is_void
  );
  if (validKills.length === 0) return null;

  // The active kill round for a channel is the latest recorded round (by created_at).
  // When a user modifies that round's killed_at time, it remains the active kill and updates status immediately!
  // If a new live kill is submitted, its newer created_at guarantees it supersedes previous rounds.
  validKills.sort((a, b) => {
    const createdA = new Date(a.created_at).getTime() || 0;
    const createdB = new Date(b.created_at).getTime() || 0;
    if (createdB !== createdA) {
      return createdB - createdA;
    }
    return new Date(b.killed_at).getTime() - new Date(a.killed_at).getTime();
  });
  return validKills[0];
}

export function computeChannelStatus(
  channel: Channel,
  now: Date = new Date()
): ChannelComputedView {
  const db = loadDB();
  const latestKill = getLatestValidKill(channel.channel_no);

  const activeVisits = db.channel_visits.filter(
    (v) => v.channel_no === channel.channel_no && v.status === 'active'
  );

  const active_visitors = activeVisits.map((v) => ({
    user_id: v.user_id,
    game_id: v.game_id,
    username: v.username,
    joined_at: v.joined_at,
  }));

  if (!latestKill) {
    return {
      channel_no: channel.channel_no,
      channel_note: channel.channel_note || '',
      channel_tag: channel.channel_tag || '',
      status: 'unrecorded',
      status_label: '未记录',
      last_kill: null,
      killed_at_display: '--',
      entry_at_display: '--',
      guaranteed_at_display: '--',
      remaining_seconds_entry: null,
      remaining_seconds_guaranteed: null,
      overdue_seconds_guaranteed: null,
      active_visitors,
      version: channel.version,
      updated_at: channel.updated_at,
    };
  }

  const nowMs = now.getTime();
  const entryMs = new Date(latestKill.entry_at).getTime();
  const guaranteedMs = new Date(latestKill.guaranteed_at).getTime();

  let status: ChannelStatus = 'unrecorded';
  let status_label = '未记录';
  let remaining_seconds_entry: number | null = null;
  let remaining_seconds_guaranteed: number | null = null;
  let overdue_seconds_guaranteed: number | null = null;

  if (nowMs < entryMs) {
    status = 'waiting_entry';
    status_label = '等待进刷';
    remaining_seconds_entry = Math.max(0, Math.floor((entryMs - nowMs) / 1000));
  } else if (nowMs < guaranteedMs) {
    status = 'in_spawn_window';
    status_label = '已进入刷时间';
    remaining_seconds_guaranteed = Math.max(0, Math.floor((guaranteedMs - nowMs) / 1000));
  } else {
    status = 'guaranteed_reached';
    status_label = '已到保底';
    overdue_seconds_guaranteed = Math.max(0, Math.floor((nowMs - guaranteedMs) / 1000));
  }

  return {
    channel_no: channel.channel_no,
    channel_note: channel.channel_note || '',
    status,
    status_label,
    last_kill: latestKill,
    killed_at_display: formatShanghai(latestKill.killed_at),
    entry_at_display: formatShanghai(latestKill.entry_at),
    guaranteed_at_display: formatShanghai(latestKill.guaranteed_at),
    remaining_seconds_entry,
    remaining_seconds_guaranteed,
    overdue_seconds_guaranteed,
    active_visitors,
    version: channel.version,
    updated_at: channel.updated_at,
  };
}

export function getAllChannelsComputed(now: Date = new Date()): ChannelComputedView[] {
  const db = loadDB();
  return db.channels.map((ch) => computeChannelStatus(ch, now));
}

export function logOperation(params: {
  user_id: string;
  username: string;
  channel_no?: number;
  record_id?: string;
  action: string;
  old_data?: any;
  new_data?: any;
  request_id?: string;
}): OperationLog {
  const db = loadDB();
  const log: OperationLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.user_id,
    username: params.username,
    channel_no: params.channel_no,
    record_id: params.record_id,
    action: params.action,
    old_data: params.old_data,
    new_data: params.new_data,
    created_at: new Date().toISOString(),
    request_id: params.request_id || `req_${Date.now()}`,
  };

  db.operation_logs.unshift(log);
  // Keep last 3000 logs
  if (db.operation_logs.length > 3000) {
    db.operation_logs.length = 3000;
  }
  scheduleSave();
  return log;
}

export function cleanupExpiredVisits(): void {
  const db = loadDB();
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  let changed = false;

  for (const visit of db.channel_visits) {
    if (visit.status === 'active') {
      const last = new Date(visit.last_heartbeat_at).getTime();
      if (now - last > ONE_HOUR) {
        visit.status = 'expired';
        visit.left_at = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed) {
    scheduleSave();
  }
}

// Create automated backup
export function createBackup(label: string = 'manual'): string {
  const db = loadDB();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${label}_${timestamp}.json`;
  const fullPath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(fullPath, JSON.stringify(db, null, 2), 'utf-8');

  // Maintain max 20 backups
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
    if (files.length > 20) {
      files.sort();
      const toDelete = files.slice(0, files.length - 20);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
      }
    }
  } catch (err) {
    console.error('Error trimming backups', err);
  }

  return filename;
}

export function listBackups(): { name: string; size: number; created_at: string }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return {
      name: f,
      size: stat.size,
      created_at: stat.mtime.toISOString(),
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function restoreBackup(filename: string): boolean {
  const fullPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(fullPath)) return false;
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content) as DBState;
    dbState = parsed;
    saveDBImmediate();
    return true;
  } catch (e) {
    console.error('Failed to restore backup', e);
    return false;
  }
}
