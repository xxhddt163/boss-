let serverTimeOffsetMs = 0;

export function setServerTimeSync(serverIso: string): void {
  try {
    const serverMs = new Date(serverIso).getTime();
    serverTimeOffsetMs = serverMs - Date.now();
  } catch (e) {
    // ignore
  }
}

export function getCurrentServerTime(): Date {
  return new Date(Date.now() + serverTimeOffsetMs);
}

export function formatBeijing(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '--';
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
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

// Extract Year, Month, Day, Hour, Minute, Second strictly in Asia/Shanghai timezone
export function getBeijingParts(dateOrIso?: Date | string | null): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const d = dateOrIso
    ? typeof dateOrIso === 'string'
      ? new Date(dateOrIso)
      : dateOrIso
    : getCurrentServerTime();

  const validDate = isNaN(d.getTime()) ? getCurrentServerTime() : d;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(validDate);
  const getPart = (type: string, fallback: number) => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : fallback;
  };

  const hourRaw = getPart('hour', 0);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: getPart('year', 2026),
    month: getPart('month', 1),
    day: getPart('day', 1),
    hour,
    minute: getPart('minute', 0),
    second: getPart('second', 0),
  };
}

// Create a valid Date object from Beijing Time components
export function createDateFromBeijingParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;
  return new Date(isoStr);
}

// Format full date time in Beijing Time: YYYY-MM-DD HH:mm:ss
export function formatBeijingDateTime(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '--:--:--';
  const parts = getBeijingParts(dateOrIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export interface CountdownInfo {
  status: 'unrecorded' | 'waiting_entry' | 'in_spawn_window' | 'guaranteed_reached';
  text: string;
  subText: string;
  isUrgent: boolean;
}

export function calculateLiveCountdown(
  channel: {
    status: 'unrecorded' | 'waiting_entry' | 'in_spawn_window' | 'guaranteed_reached';
    last_kill: { entry_at: string; guaranteed_at: string } | null;
  },
  now: Date
): CountdownInfo {
  if (!channel.last_kill) {
    return {
      status: 'unrecorded',
      text: '--:--:--',
      subText: '暂无击杀记录',
      isUrgent: false,
    };
  }

  const nowMs = now.getTime();
  const entryMs = new Date(channel.last_kill.entry_at).getTime();
  const guaranteedMs = new Date(channel.last_kill.guaranteed_at).getTime();

  if (nowMs < entryMs) {
    const diffSec = Math.max(0, Math.floor((entryMs - nowMs) / 1000));
    return {
      status: 'waiting_entry',
      text: formatDuration(diffSec),
      subText: '距离进刷',
      isUrgent: diffSec <= 300, // <= 5 min
    };
  } else if (nowMs < guaranteedMs) {
    const diffSec = Math.max(0, Math.floor((guaranteedMs - nowMs) / 1000));
    return {
      status: 'in_spawn_window',
      text: formatDuration(diffSec),
      subText: '距离保底',
      isUrgent: true,
    };
  } else {
    const overdueSec = Math.max(0, Math.floor((nowMs - guaranteedMs) / 1000));
    return {
      status: 'guaranteed_reached',
      text: `+${formatDuration(overdueSec)}`,
      subText: '超过保底',
      isUrgent: true,
    };
  }
}
