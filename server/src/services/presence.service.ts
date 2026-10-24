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
  // canonicalUsername -> Set of ConnectedClient
  private activeConnections = new Map<string, Set<ConnectedClient>>();
  // ws -> ConnectedClient mapping for fast lookup
  private clientLookup = new WeakMap<WebSocket, ConnectedClient>();

  /**
   * Register a connected user
   */
  public register(client: ConnectedClient): void {
    const { canonicalUsername } = client;
    let userSockets = this.activeConnections.get(canonicalUsername);
    if (!userSockets) {
      userSockets = new Set();
      this.activeConnections.set(canonicalUsername, userSockets);
      logger.info(`User came online: ${client.username}`);
      this.broadcastPresence(canonicalUsername, true);
    }
    userSockets.add(client);
    this.clientLookup.set(client.ws, client);
  }

  /**
   * Unregister a disconnected client
   */
  public unregister(ws: WebSocket): ConnectedClient | undefined {
    const client = this.clientLookup.get(ws);
    if (!client) return undefined;

    const { canonicalUsername, username } = client;
    const userSockets = this.activeConnections.get(canonicalUsername);
    if (userSockets) {
      userSockets.delete(client);
      if (userSockets.size === 0) {
        this.activeConnections.delete(canonicalUsername);
        logger.info(`User went offline: ${username}`);
        this.broadcastPresence(canonicalUsername, false);
      }
    }

    return client;
  }

  /**
   * Check if a user is currently online
   */
  public isOnline(canonicalUsername: string): boolean {
    const sockets = this.activeConnections.get(canonicalUsername.toLowerCase());
    return !!(sockets && sockets.size > 0);
  }

  /**
   * Get all active sockets for a given user
   */
  public getSockets(canonicalUsername: string): WebSocket[] {
    const sockets = this.activeConnections.get(canonicalUsername.toLowerCase());
    if (!sockets) return [];
    return Array.from(sockets).map((c) => c.ws);
  }

  /**
   * Disconnect a user completely (e.g. on account deletion or session revocation)
   */
  public disconnectUser(canonicalUsername: string, reason: string): void {
    const sockets = this.activeConnections.get(canonicalUsername.toLowerCase());
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
      this.activeConnections.delete(canonicalUsername.toLowerCase());
      this.broadcastPresence(canonicalUsername, false);
    }
  }

  /**
   * Send a presence notification to interested connected users
   */
  private broadcastPresence(canonicalUsername: string, isOnline: boolean): void {
    const payload = JSON.stringify({
      type: 'presence-update',
      payload: {
        canonicalUsername,
        isOnline,
        timestamp: new Date().toISOString(),
      },
    });

    for (const clients of this.activeConnections.values()) {
      for (const client of clients) {
        if (client.canonicalUsername !== canonicalUsername && client.ws.readyState === 1 /* OPEN */) {
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
