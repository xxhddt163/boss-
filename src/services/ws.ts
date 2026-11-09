import { setServerTimeSync } from '../utils/time.ts';
import { sound, sendDesktopNotification } from '../utils/sound.ts';

type Listener = (payload: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;
  private connected: boolean = false;
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private identifiedUser: { userId: string; username: string; gameId: string } | null = null;
  private clientIpInfo: { ip: string; location?: string } | null = null;
  private ipDetectStarted: boolean = false;

  public connect(): void {
    this.ensureClientIpDetected();
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.isConnecting = false;
        this.notifyStatus(true);
        this.sendIdentify();
        this.sendClientIpInfo();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.serverTime) {
            setServerTimeSync(data.serverTime);
          }

          if (data.type === 'BOSS_ALERT') {
            if (!this.identifiedUser) return;
            if (data.stage === 'before_entry') {
              sound.playBeforeEntry();
            } else if (data.stage === 'entry_reached') {
              sound.playEntryReached();
            } else if (data.stage === 'guaranteed_reached') {
              sound.playGuaranteedReached();
            }
            sendDesktopNotification(data.title, data.message);
          }

          this.listeners.forEach((listener) => listener(data));
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.cleanup();
        this.scheduleReconnect();
      };
    } catch {
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  private ensureClientIpDetected(): void {
    if (this.ipDetectStarted) return;
    this.ipDetectStarted = true;

    try {
      const cached = sessionStorage.getItem('snowman_client_ip_info');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.ip) {
          this.clientIpInfo = parsed;
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    (async () => {
      // Try ipwho.is (CORS-enabled HTTPS with Chinese location)
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://ipwho.is/?lang=zh-CN', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ip) {
            const locParts = [
              data.country === '中国' ? '' : data.country,
              data.region,
              data.city && data.city !== data.region ? data.city : '',
            ].filter(Boolean);
            const location = locParts.join(' ');
            this.clientIpInfo = { ip: data.ip, location: location || undefined };
            try {
              sessionStorage.setItem('snowman_client_ip_info', JSON.stringify(this.clientIpInfo));
            } catch {
              // ignore
            }
            this.sendClientIpInfo();
            return;
          }
        }
      } catch {
        // Fallback to next public IP endpoint
      }

      // Fallback: ipify
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ip) {
            this.clientIpInfo = { ip: data.ip };
            try {
              sessionStorage.setItem('snowman_client_ip_info', JSON.stringify(this.clientIpInfo));
            } catch {
              // ignore
            }
            this.sendClientIpInfo();
          }
        }
      } catch {
        // ignore
      }
    })();
  }

  private cleanup(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
    this.isConnecting = false;
    this.notifyStatus(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private notifyStatus(connected: boolean): void {
    this.statusListeners.forEach((fn) => fn(connected));
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeStatus(fn: (connected: boolean) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.connected);
    return () => this.statusListeners.delete(fn);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public identify(user: { id: string; username: string; game_id: string } | null): void {
    if (user) {
      this.identifiedUser = { userId: user.id, username: user.username, gameId: user.game_id };
    } else {
      this.identifiedUser = null;
    }
    this.sendIdentify();
  }

  private sendIdentify(): void {
    if (this.ws && this.connected && this.identifiedUser) {
      try {
        this.ws.send(JSON.stringify({
          type: 'IDENTIFY',
          userId: this.identifiedUser.userId,
          username: this.identifiedUser.username,
          gameId: this.identifiedUser.gameId,
          clientIp: this.clientIpInfo?.ip,
          clientLocation: this.clientIpInfo?.location,
        }));
      } catch {
        // ignore
      }
    }
  }

  private sendClientIpInfo(): void {
    if (this.ws && this.connected && this.clientIpInfo?.ip) {
      try {
        this.ws.send(JSON.stringify({
          type: 'CLIENT_IP_INFO',
          clientIp: this.clientIpInfo.ip,
          clientLocation: this.clientIpInfo.location,
        }));
      } catch {
        // ignore
      }
    }
  }
}

export const wsClient = new WebSocketClient();
