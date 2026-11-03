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
