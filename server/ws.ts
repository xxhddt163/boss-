import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import {
  getAllChannelsComputed,
  loadDB,
  cleanupExpiredVisits,
  formatShanghai,
} from './db.ts';

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  username?: string;
  gameId?: string;
  ip?: string;
  connectedAt: Date;
}

let wss: WebSocketServer | null = null;
const clients = new Set<ConnectedClient>();
const triggeredAlerts = new Set<string>(); // key: `${channelNo}_${killId}_${stage}`

export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const client: ConnectedClient = {
      ws,
      ip: req.socket.remoteAddress,
      connectedAt: new Date(),
    };
    clients.add(client);

    // Send initial snapshot
    const now = new Date();
    const channels = getAllChannelsComputed(now);
    const db = loadDB();

    safeSend(ws, {
      type: 'INIT_STATE',
      serverTime: now.toISOString(),
      onlineCount: clients.size,
      channels,
      boss: db.boss,
      settings: db.settings,
    });

    broadcastOnlineCount();

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'IDENTIFY') {
          client.userId = data.userId;
          client.username = data.username;
          client.gameId = data.gameId;
        } else if (data.type === 'HEARTBEAT') {
          safeSend(ws, { type: 'PONG', serverTime: new Date().toISOString() });
        }
      } catch (err) {
        // Ignore malformed message
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      broadcastOnlineCount();
    });

    ws.on('error', (err) => {
      console.error('WS client error', err);
      clients.delete(client);
      broadcastOnlineCount();
    });
  });

  // Background ticker: every 1 second, sync server time & check alerts
  setInterval(() => {
    const now = new Date();
    broadcastClockAndCheckAlerts(now);
  }, 1000);

  // Periodic visit cleanup every 5 minutes
  setInterval(() => {
    cleanupExpiredVisits();
  }, 5 * 60 * 1000);

  return wss;
}

function safeSend(ws: WebSocket, payload: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  }
}

export function broadcastAll(payload: any): void {
  const json = JSON.stringify(payload);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(json);
      } catch (e) {
        // ignore
      }
    }
  }
}

export function broadcastOnlineCount(): void {
  broadcastAll({
    type: 'ONLINE_COUNT',
    count: clients.size,
  });
}

export function broadcastChannelsUpdate(): void {
  const now = new Date();
  const channels = getAllChannelsComputed(now);
  broadcastAll({
    type: 'CHANNELS_UPDATE',
    serverTime: now.toISOString(),
    channels,
  });
}

function broadcastClockAndCheckAlerts(now: Date): void {
  const nowMs = now.getTime();
  const db = loadDB();
  const reminderMinutes = db.settings.reminder_before || 5;
  const reminderMs = reminderMinutes * 60 * 1000;

  // Broadcast clock tick
  broadcastAll({
    type: 'CLOCK_TICK',
    serverTime: now.toISOString(),
  });

  // Check alerts
  for (const channel of db.channels) {
    const latestValid = db.kill_records
      .filter((k) => k.channel_no === channel.channel_no && !k.is_void)
      .sort((a, b) => new Date(b.killed_at).getTime() - new Date(a.killed_at).getTime())[0];

    if (!latestValid) continue;

    const killId = latestValid.id;
    const entryMs = new Date(latestValid.entry_at).getTime();
    const guaranteedMs = new Date(latestValid.guaranteed_at).getTime();

    // 1. 5 minutes before entry
    const before5mKey = `${channel.channel_no}_${killId}_before_${reminderMinutes}m`;
    if (nowMs >= entryMs - reminderMs && nowMs < entryMs) {
      if (!triggeredAlerts.has(before5mKey)) {
        triggeredAlerts.add(before5mKey);
        broadcastAll({
          type: 'BOSS_ALERT',
          channel_no: channel.channel_no,
          stage: 'before_entry',
          title: `${channel.channel_no}频道 即将进刷`,
          message: `${channel.channel_no}频道 距离进刷仅剩 ${reminderMinutes} 分钟（进刷时间 ${formatShanghai(latestValid.entry_at)}）`,
          serverTime: now.toISOString(),
        });
      }
    }

    // 2. Reached entry time
    const entryKey = `${channel.channel_no}_${killId}_entry`;
    if (nowMs >= entryMs && nowMs < guaranteedMs) {
      if (!triggeredAlerts.has(entryKey)) {
        triggeredAlerts.add(entryKey);
        broadcastAll({
          type: 'BOSS_ALERT',
          channel_no: channel.channel_no,
          stage: 'entry_reached',
          title: `${channel.channel_no}频道 已进入刷时间`,
          message: `${channel.channel_no}频道 已经可以刷新，请蹲守击杀！（保底时间 ${formatShanghai(latestValid.guaranteed_at)}）`,
          serverTime: now.toISOString(),
        });
      }
    }

    // 3. Reached guaranteed time
    const guaranteedKey = `${channel.channel_no}_${killId}_guaranteed`;
    if (nowMs >= guaranteedMs) {
      if (!triggeredAlerts.has(guaranteedKey)) {
        triggeredAlerts.add(guaranteedKey);
        broadcastAll({
          type: 'BOSS_ALERT',
          channel_no: channel.channel_no,
          stage: 'guaranteed_reached',
          title: `${channel.channel_no}频道 已到保底`,
          message: `${channel.channel_no}频道 已达保底时间（${formatShanghai(latestValid.guaranteed_at)}），请火速确认击杀！`,
          serverTime: now.toISOString(),
        });
      }
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
