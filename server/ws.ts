import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import {
  getAllChannelsComputed,
  loadDB,
  cleanupExpiredVisits,
  formatShanghai,
  autoResetOverdueChannels,
  getLatestValidKill,
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
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss?.handleUpgrade(req, socket, head, (ws) => {
          wss?.emit('connection', ws, req);
        });
      }
    } catch {
      // ignore invalid upgrade url
    }
  });

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
      onlineCount: getUniqueOnlineCount(),
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
          broadcastOnlineCount();
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

export function broadcastAuthenticated(payload: any): void {
  const json = JSON.stringify(payload);
  for (const client of clients) {
    if (client.userId && client.ws.readyState === WebSocket.OPEN) {
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
    count: getUniqueOnlineCount(),
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
  // Auto-reset channels if overdue past guaranteed time >= 180 minutes
  const resetCount = autoResetOverdueChannels(now);
  if (resetCount > 0) {
    broadcastChannelsUpdate();
  }

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
    const latestValid = getLatestValidKill(channel.channel_no);

    if (!latestValid) continue;

    const killId = latestValid.id;
    const entryMs = new Date(latestValid.entry_at).getTime();
    const guaranteedMs = new Date(latestValid.guaranteed_at).getTime();

    // 1. 5 minutes before entry
    const before5mKey = `${channel.channel_no}_${killId}_before_${reminderMinutes}m`;
    if (nowMs >= entryMs - reminderMs && nowMs < entryMs) {
      if (!triggeredAlerts.has(before5mKey)) {
        triggeredAlerts.add(before5mKey);
        broadcastAuthenticated({
          type: 'BOSS_ALERT',
          alert_key: before5mKey,
          kill_id: killId,
          channel_no: channel.channel_no,
          stage: 'before_entry',
          title: `${channel.channel_no}频道 即将进刷`,
          message: `${channel.channel_no}频道 距离进入刷新时间仅剩${reminderMinutes}分钟`,
          serverTime: now.toISOString(),
        });
      }
    }

    // 2. Reached entry time
    const entryKey = `${channel.channel_no}_${killId}_entry`;
    if (nowMs >= entryMs && nowMs < guaranteedMs) {
      if (!triggeredAlerts.has(entryKey)) {
        triggeredAlerts.add(entryKey);
        broadcastAuthenticated({
          type: 'BOSS_ALERT',
          alert_key: entryKey,
          kill_id: killId,
          channel_no: channel.channel_no,
          stage: 'entry_reached',
          title: `${channel.channel_no}频道 已进入刷新时间`,
          message: `${channel.channel_no}频道已经可以刷新，请蹲守击杀！`,
          serverTime: now.toISOString(),
        });
      }
    }

    // 3. Reached guaranteed time
    const guaranteedKey = `${channel.channel_no}_${killId}_guaranteed`;
    if (nowMs >= guaranteedMs && nowMs - guaranteedMs < 180 * 60 * 1000) {
      if (!triggeredAlerts.has(guaranteedKey)) {
        triggeredAlerts.add(guaranteedKey);
        broadcastAuthenticated({
          type: 'BOSS_ALERT',
          alert_key: guaranteedKey,
          kill_id: killId,
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

export function getUniqueOnlineCount(): number {
  return getOnlinePlayersList().length;
}

export function getConnectedClientCount(): number {
  return getUniqueOnlineCount();
}

export interface OnlinePlayerInfo {
  userId?: string;
  username: string;
  gameId: string;
  nickname?: string;
  phone?: string;
  role: string;
  currentChannelNo?: number | null;
  activeChannelNos?: number[];
  connectedAt: string;
  isGuest: boolean;
  connectionsCount?: number;
}

export function getOnlinePlayersList(): OnlinePlayerInfo[] {
  const db = loadDB();
  const list: OnlinePlayerInfo[] = [];
  const seenUsers = new Map<string, OnlinePlayerInfo>();

  clients.forEach((c) => {
    if (c.userId) {
      const existing = seenUsers.get(c.userId);
      if (existing) {
        existing.connectionsCount = (existing.connectionsCount || 1) + 1;
        return;
      }

      const dbUser = db.users.find((u) => u.id === c.userId);
      const activeVisits = db.channel_visits.filter(
        (v) => v.user_id === c.userId && v.status === 'active'
      );
      const activeChannelNos = activeVisits.map((v) => v.channel_no);

      const playerInfo: OnlinePlayerInfo = {
        userId: c.userId,
        username: c.username || dbUser?.username || '未知玩家',
        gameId: c.gameId || dbUser?.game_id || '未登记',
        nickname: dbUser?.nickname,
        phone: dbUser?.phone,
        role: dbUser?.role || 'player',
        currentChannelNo: activeChannelNos[0] ?? null,
        activeChannelNos,
        connectedAt: c.connectedAt.toISOString(),
        isGuest: false,
        connectionsCount: 1,
      };

      seenUsers.set(c.userId, playerInfo);
      list.push(playerInfo);
    } else {
      list.push({
        username: '未登录访客',
        gameId: '访客',
        role: 'guest',
        currentChannelNo: null,
        activeChannelNos: [],
        connectedAt: c.connectedAt.toISOString(),
        isGuest: true,
        connectionsCount: 1,
      });
    }
  });

  list.sort((a, b) => {
    if (a.isGuest && !b.isGuest) return 1;
    if (!a.isGuest && b.isGuest) return -1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return (a.gameId || '').localeCompare(b.gameId || '');
  });

  return list;
}
