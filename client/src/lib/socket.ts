/**
 * Secure WebSocket Client for SPILLOUT
 * Real-time presence, ephemeral message relay, and WebRTC signaling
 */

type Listener<T = any> = (data: T) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private isExplicitlyClosed = false;
  private isConnecting = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In development, backend runs on port 4000; in production or proxy, relative or custom
      const host = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.hostname}:4000/ws`;
      this.url = host;
    }
  }

  public connect(token?: string): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.isConnecting = true;
    this.emit('connection-status', { status: 'connecting' });

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.emit('connection-status', { status: 'connected' });
        this.startHeartbeat();

        // Send auth if token provided
        if (token) {
          this.send('auth', { token });
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          if (type === 'pong') {
            return;
          }

          this.emit(type, payload);
          this.emit('*', message);
        } catch (err) {
          console.error('[WS Parse Error]', err);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.emit('connection-status', { status: 'disconnected', code: event.code, reason: event.reason });

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect(token);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS Error]', err);
        this.emit('connection-status', { status: 'error', error: err });
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect(token);
    }
  }

  private scheduleReconnect(token?: string): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect(token);
      }
    }, 3000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public send(type: string, payload: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  public sendE2EEMessage(
    recipientUsername: string,
    ciphertext: string,
    iv: string,
    senderEphemeralPublicKey: string
  ): boolean {
    return this.send('send-e2ee-message', {
      recipientUsername,
      ciphertext,
      iv,
      senderEphemeralPublicKey,
    });
  }

  public sendSignal(targetUsername: string, signalType: string, extraData?: any): boolean {
    return this.send('webrtc-signal', {
      targetUsername,
      signalType,
      ...extraData,
    });
  }

  public checkPresence(username: string): boolean {
    return this.send('check-presence', { username });
  }

  public on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  public off(event: string, listener: Listener): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'User logged out');
      this.ws = null;
    }
  }
}

export const socket = new SocketClient();
