import { ChannelComputedView, BossConfig, User } from '../types.ts';
import { calculateLiveCountdown, formatBeijing } from './time.ts';

const CHANNELS_CACHE_KEY = 'boss_channels_emergency_cache_v1';
const USER_CACHE_KEY = 'boss_user_emergency_cache_v1';

/**
 * Save latest channels data and boss config to localStorage for offline disaster recovery
 */
export function saveOfflineChannelsCache(channels: ChannelComputedView[], boss: BossConfig | null): void {
  if (!channels || channels.length === 0) return;
  try {
    const payload = {
      channels,
      boss,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CHANNELS_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore localStorage quota errors
  }
}

/**
 * Load cached channels data from localStorage when server is unreachable
 */
export function loadOfflineChannelsCache(): {
  channels: ChannelComputedView[];
  boss: BossConfig | null;
  savedAt: string;
} | null {
  try {
    const item = localStorage.getItem(CHANNELS_CACHE_KEY);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (parsed && Array.isArray(parsed.channels) && parsed.channels.length > 0) {
      return parsed;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Save current user profile for offline session continuity
 */
export function saveOfflineUserCache(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Load cached user profile
 */
export function loadOfflineUserCache(): User | null {
  try {
    const item = localStorage.getItem(USER_CACHE_KEY);
    if (!item) return null;
    return JSON.parse(item);
  } catch (e) {
    return null;
  }
}

/**
 * Escape a cell value for CSV format
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // If string contains comma, double-quote, or newline, wrap in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Format date for filename (YYYYMMDD_HHmmss)
 */
function getFilenameTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

/**
 * Export 60 channels time information directly from browser memory / local cache into CSV (Excel-compatible)
 * Pure client-side execution - works 100% offline without any server connection!
 */
export function exportChannelsToCSV(
  channels: ChannelComputedView[],
  bossName: string = '驮狼雪人',
  isOffline: boolean = false
): { success: boolean; filename: string; rowCount: number } {
  if (!channels || channels.length === 0) {
    throw new Error('当前没有可导出的频道数据');
  }

  const now = new Date();
  const exportTimeStr = formatBeijing(now.toISOString());

  // 1. Metadata comments
  const lines: string[] = [
    `# 游戏Boss刷新时间管理系统 - 频道时间快照导出表格`,
    `# 导出时间：${exportTimeStr} | 监控Boss：${bossName} | 运行状态：${isOffline ? '服务器离线（本地容灾快照）' : '正常在线快照'}`,
    `# 提示：本表格采用 UTF-8 BOM 编码，完美兼容 Excel、WPS 双击直接打开，中文字符绝不乱码。`,
    '',
  ];

  // 2. Table Headers
  const headers = [
    '频道编号',
    '频道标签',
    '当前状态',
    '实时倒计时/超时',
    '最近击杀时间',
    '进刷开始时间',
    '保底到达时间',
    '当前蹲守/接单人员',
    '频道长期备注',
    '最近击杀玩家',
    '击杀备注',
  ];
  lines.push(headers.map(escapeCsv).join(','));

  // 3. Table Rows sorted 1 to 60
  const sortedChannels = [...channels].sort((a, b) => a.channel_no - b.channel_no);

  for (const ch of sortedChannels) {
    const countdown = calculateLiveCountdown(ch, now);

    // Active visitors format
    const visitorsText =
      ch.active_visitors && ch.active_visitors.length > 0
        ? ch.active_visitors.map((v) => `${v.game_id}${v.username ? `(${v.username})` : ''}`).join('、')
        : '暂无人员蹲守';

    const row = [
      `${ch.channel_no}频道`,
      ch.channel_tag || '无',
      countdown.subText ? `${ch.status_label}(${countdown.subText})` : ch.status_label,
      countdown.text,
      ch.killed_at_display || '--:--:--',
      ch.entry_at_display || '--:--:--',
      ch.guaranteed_at_display || '--:--:--',
      visitorsText,
      ch.channel_note || '',
      ch.last_kill ? `${ch.last_kill.game_id || ch.last_kill.created_by}` : '无',
      ch.last_kill?.kill_note || '',
    ];

    lines.push(row.map(escapeCsv).join(','));
  }

  const csvContent = lines.join('\r\n');
  // Add UTF-8 BOM (\uFEFF) to guarantee Excel/WPS renders Chinese properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  const filename = `${bossName}_全频道时间快照_${getFilenameTimestamp(now)}.csv`;

  // Trigger client-side direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);

  return {
    success: true,
    filename,
    rowCount: sortedChannels.length,
  };
}
