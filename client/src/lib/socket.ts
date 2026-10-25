/**
 * Secure WebSocket Client for SPILLOUT
 * Real-time presence, ephemeral message relay, and WebRTC signaling
 */

import { getApiSessionToken } from './api';

type Listener<T = any> = (data: T) => void;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

class SocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private isExplicitlyClosed = false;
  private isConnecting = false;

  private getWsUrl(token?: string | null): string {
    let base = process.env.NEXT_PUBLIC_WS_URL;

    if (!base && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      base = window.location.port === '3000'
        ? `${protocol}//${window.location.hostname}:4000/ws`
        : `${protocol}//${window.location.host}/ws`;
    }

    if (!base) {
      base = 'ws://localhost:4000/ws';
    }

    // Convert http/https to ws/wss if incorrectly provided
    if (base.startsWith('https://')) {
      base = 'wss://' + base.slice(8);
    } else if (base.startsWith('http://')) {
      base = 'ws://' + base.slice(7);
    }

    let trimmed = base.trim().replace(/\/+$/, '');
    if (!trimmed.endsWith('/ws')) {
      trimmed = `${trimmed}/ws`;
    }

    const activeToken = token || this.token || getApiSessionToken();
    if (activeToken) {
      const separator = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${separator}token=${encodeURIComponent(activeToken)}`;
    }

    return trimmed;
  }

  public connect(token?: string): void {
    if (typeof window === 'undefined') return;

    if (token) {
      this.token = token;
    } else if (!this.token) {
      this.token = getApiSessionToken();
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      // If already connected and token was provided, ensure authenticated
      if (this.ws.readyState === WebSocket.OPEN && this.token) {
        this.send('auth', { token: this.token });
      }
      return;
    }

    this.isExplicitlyClosed = false;
    this.isConnecting = true;
    this.emit('connection-status', { status: 'connecting' });

    try {
      const targetUrl = this.getWsUrl(this.token);
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.emit('connection-status', { status: 'connected' });
        this.startHeartbeat();

        // Send auth payload for complete handshake redundancy
        const activeToken = this.token || getApiSessionToken();
        if (activeToken) {
          this.send('auth', { token: activeToken });
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
        this.emit('connection-status', {
          status: 'disconnected',
          code: event.code,
          reason: event.reason,
        });

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS Error]', err);
        this.emit('connection-status', { status: 'error', error: err });
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.emit('connection-status', { status: 'reconnecting' });

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, 2500);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
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

    try {
      this.ws.send(JSON.stringify({ type, payload }));
      return true;
    } catch {
      return false;
    }
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
    this.token = null;
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
