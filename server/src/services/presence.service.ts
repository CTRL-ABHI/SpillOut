import type { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

export interface ConnectedClient {
  ws: WebSocket;
  username: string;
  canonicalUsername: string;
  userId: string;
  connectedAt: Date;
}

export class PresenceService {
  // canonicalUsername (lowercase) -> Set of ConnectedClient
  private activeConnections = new Map<string, Set<ConnectedClient>>();
  // ws -> ConnectedClient mapping for fast lookup
  private clientLookup = new WeakMap<WebSocket, ConnectedClient>();

  private normalize(username: string): string {
    return (username || '').toLowerCase().trim();
  }

  /**
   * Register a connected user connection
   */
  public register(client: ConnectedClient): void {
    const key = this.normalize(client.canonicalUsername || client.username);
    if (!key) return;

    let userSockets = this.activeConnections.get(key);
    const wasOnline = this.isOnline(key);

    if (!userSockets) {
      userSockets = new Set();
      this.activeConnections.set(key, userSockets);
    }

    userSockets.add(client);
    this.clientLookup.set(client.ws, client);

    // Only broadcast online if the user transitioned from 0 active open connections to >= 1
    if (!wasOnline) {
      logger.info(`User came online: ${client.username} (${key})`);
      this.broadcastPresence(key, true);
    }
  }

  /**
   * Unregister a disconnected client
   */
  public unregister(ws: WebSocket): ConnectedClient | undefined {
    const client = this.clientLookup.get(ws);
    if (!client) return undefined;

    const key = this.normalize(client.canonicalUsername || client.username);
    const userSockets = this.activeConnections.get(key);

    if (userSockets) {
      userSockets.delete(client);

      // Check if user still has at least one active open socket
      const stillOnline = Array.from(userSockets).some((c) => c.ws.readyState === 1 /* OPEN */);

      if (!stillOnline) {
        this.activeConnections.delete(key);
        logger.info(`User went offline: ${client.username} (${key})`);
        this.broadcastPresence(key, false);
      }
    }

    return client;
  }

  /**
   * Check if a user is currently online with at least one active OPEN socket
   */
  public isOnline(canonicalUsername: string): boolean {
    const key = this.normalize(canonicalUsername);
    const sockets = this.activeConnections.get(key);
    if (!sockets || sockets.size === 0) return false;

    for (const client of sockets) {
      if (client.ws.readyState === 1 /* OPEN */) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all active OPEN sockets for a given user
   */
  public getSockets(canonicalUsername: string): WebSocket[] {
    const key = this.normalize(canonicalUsername);
    const sockets = this.activeConnections.get(key);
    if (!sockets) return [];

    return Array.from(sockets)
      .map((c) => c.ws)
      .filter((ws) => ws.readyState === 1 /* OPEN */);
  }

  /**
   * Get list of all canonical usernames currently online
   */
  public getOnlineUsers(): string[] {
    const online: string[] = [];
    for (const [key, sockets] of this.activeConnections.entries()) {
      const hasOpen = Array.from(sockets).some((c) => c.ws.readyState === 1 /* OPEN */);
      if (hasOpen) {
        online.push(key);
      }
    }
    return online;
  }

  /**
   * Disconnect a user completely (e.g. on account deletion or session revocation)
   */
  public disconnectUser(canonicalUsername: string, reason: string): void {
    const key = this.normalize(canonicalUsername);
    const sockets = this.activeConnections.get(key);
    if (sockets) {
      for (const client of sockets) {
        try {
          client.ws.send(
            JSON.stringify({
              type: 'system-notice',
              payload: { message: reason, code: 'TERMINATED' },
            })
          );
          client.ws.close(4001, reason);
        } catch {
          // Socket may already be closing
        }
      }
      this.activeConnections.delete(key);
      this.broadcastPresence(key, false);
    }
  }

  /**
   * Send a presence notification to interested connected users
   */
  private broadcastPresence(canonicalUsername: string, isOnline: boolean): void {
    const key = this.normalize(canonicalUsername);
    const payload = JSON.stringify({
      type: 'presence-update',
      payload: {
        canonicalUsername: key,
        isOnline,
        timestamp: new Date().toISOString(),
      },
    });

    for (const [userKey, clients] of this.activeConnections.entries()) {
      if (userKey === key) continue; // Don't echo to self

      for (const client of clients) {
        if (client.ws.readyState === 1 /* OPEN */) {
          try {
            client.ws.send(payload);
          } catch {
            // Ignore socket send errors
          }
        }
      }
    }
  }
}

export const presenceService = new PresenceService();
