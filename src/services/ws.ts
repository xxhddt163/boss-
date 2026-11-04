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

  public connect(): void {
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
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.serverTime) {
            setServerTimeSync(data.serverTime);
          }

          if (data.type === 'BOSS_ALERT') {
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
        }));
      } catch {
        // ignore
      }
    }
  }
}

export const wsClient = new WebSocketClient();
