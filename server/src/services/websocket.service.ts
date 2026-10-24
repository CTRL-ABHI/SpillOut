import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { prisma } from '../db.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { presenceService, ConnectedClient } from './presence.service.js';
import { accountCleanupService } from './account-cleanup.service.js';
import { logger } from '../utils/logger.js';

interface WSMessage {
  type: string;
  payload?: any;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookieStr) => {
    const parts = cookieStr.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

export function setupWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    logger.debug('New incoming WebSocket connection attempt');

    let currentClient: ConnectedClient | null = null;

    // Try extracting session token from cookie
    let token: string | undefined;
    if (req.headers.cookie) {
      const parsedCookies = parseCookies(req.headers.cookie);
      token = parsedCookies[SESSION_COOKIE_NAME];
    }

    // Authenticate token helper
    const authenticate = async (sessionToken: string): Promise<boolean> => {
      try {
        const session = await prisma.session.findUnique({
          where: { token: sessionToken },
          include: { user: true },
        });

        if (!session) {
          ws.send(JSON.stringify({ type: 'auth-error', error: 'Invalid session token' }));
          ws.close(4001, 'Unauthorized');
          return false;
        }

        if (session.expiresAt <= new Date()) {
          ws.send(JSON.stringify({ type: 'auth-error', error: 'Session expired' }));
          ws.close(4001, 'Session expired');
          return false;
        }

        // Check 7-day inactivity
        const cutoff = accountCleanupService.getCutoffDate();
        if (session.user.lastActivityAt < cutoff) {
          await prisma.user.delete({ where: { id: session.user.id } }).catch(() => {});
          ws.send(JSON.stringify({ type: 'auth-error', error: 'Account expired after 7 days of inactivity', code: 'ACCOUNT_EXPIRED' }));
          ws.close(4001, 'Account expired');
          return false;
        }

        currentClient = {
          ws,
          userId: session.user.id,
          username: session.user.username,
          canonicalUsername: session.user.canonicalUsername,
          connectedAt: new Date(),
        };

        presenceService.register(currentClient);

        ws.send(
          JSON.stringify({
            type: 'auth-success',
            payload: {
              username: session.user.username,
              canonicalUsername: session.user.canonicalUsername,
            },
          })
        );

        return true;
      } catch (err) {
        logger.error('WebSocket auth error', err);
        ws.send(JSON.stringify({ type: 'auth-error', error: 'Authentication failed' }));
        ws.close(4001, 'Authentication failed');
        return false;
      }
    };

    if (token) {
      await authenticate(token);
    }

    // Message handler
    ws.on('message', async (data: Buffer | string) => {
      try {
        const parsed: WSMessage = JSON.parse(data.toString());
        const { type, payload } = parsed;

        // 1. Initial auth message if cookie wasn't present
        if (type === 'auth') {
          if (payload?.token) {
            await authenticate(payload.token);
          }
          return;
        }

        // All subsequent messages require authenticated connection
        if (!currentClient) {
          ws.send(JSON.stringify({ type: 'error', error: 'Unauthorized. Authenticate first.' }));
          return;
        }

        // 2. Ping / Pong (heartbeat) - does NOT update lastActivityAt
        if (type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        // 3. Presence query
        if (type === 'check-presence') {
          const target = payload?.username?.toLowerCase()?.trim();
          if (target) {
            const isOnline = presenceService.isOnline(target);
            ws.send(
              JSON.stringify({
                type: 'presence-status',
                payload: { username: target, isOnline },
              })
            );
          }
          return;
        }

        // Helper to update lastActivityAt on meaningful actions
        const markQualifyingActivity = async () => {
          try {
            await prisma.user.update({
              where: { id: currentClient!.userId },
              data: { lastActivityAt: new Date() },
            });
          } catch (err) {
            logger.warn('Failed to update activity on action', err);
          }
        };

        // 4. End-to-End Encrypted Message Relay
        // Strictly ephemeral: never saved to DB or logs
        if (type === 'send-e2ee-message') {
          const recipientCanonical = payload?.recipientUsername?.toLowerCase()?.trim();
          if (!recipientCanonical) {
            ws.send(JSON.stringify({ type: 'error', error: 'Recipient username required' }));
            return;
          }

          if (!payload.ciphertext || !payload.iv) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid ciphertext payload' }));
            return;
          }

          // Check if recipient is online
          if (!presenceService.isOnline(recipientCanonical)) {
            ws.send(
              JSON.stringify({
                type: 'message-undeliverable',
                payload: {
                  recipient: payload.recipientUsername,
                  reason: 'Recipient is offline. SPILLOUT does not retain or queue messages for offline users.',
                },
              })
            );
            return;
          }

          const recipientSockets = presenceService.getSockets(recipientCanonical);
          const relayPayload = {
            type: 'e2ee-message',
            payload: {
              senderUsername: currentClient.username,
              senderCanonical: currentClient.canonicalUsername,
              recipientCanonical,
              ciphertext: payload.ciphertext,
              iv: payload.iv,
              tag: payload.tag,
              senderEphemeralPublicKey: payload.senderEphemeralPublicKey,
              timestamp: new Date().toISOString(),
            },
          };

          const serialized = JSON.stringify(relayPayload);
          for (const s of recipientSockets) {
            if (s.readyState === WebSocket.OPEN) {
              s.send(serialized);
            }
          }

          // Acknowledge relay to sender
          ws.send(
            JSON.stringify({
              type: 'message-relayed',
              payload: {
                recipient: payload.recipientUsername,
                timestamp: relayPayload.payload.timestamp,
              },
            })
          );

          // Update qualifying activity on chat
          markQualifyingActivity();
          return;
        }

        // 5. WebRTC Signaling for Encrypted Voice Calls
        if (type === 'webrtc-signal') {
          const signalType = payload?.signalType; // call-invite, call-accept, call-decline, call-busy, call-end, offer, answer, ice-candidate
          const target = payload?.targetUsername?.toLowerCase()?.trim();

          if (!target || !signalType) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid signaling payload' }));
            return;
          }

          if (!presenceService.isOnline(target)) {
            ws.send(
              JSON.stringify({
                type: 'call-failed',
                payload: {
                  target,
                  reason: 'User is currently offline',
                },
              })
            );
            return;
          }

          const targetSockets = presenceService.getSockets(target);
          const forwardMessage = JSON.stringify({
            type: 'webrtc-signal',
            payload: {
              ...payload,
              fromUsername: currentClient.username,
              fromCanonical: currentClient.canonicalUsername,
            },
          });

          for (const s of targetSockets) {
            if (s.readyState === WebSocket.OPEN) {
              s.send(forwardMessage);
            }
          }

          if (signalType === 'call-invite' || signalType === 'call-accept') {
            markQualifyingActivity();
          }
          return;
        }

        logger.warn(`Unknown WS message type received: ${type}`);
      } catch (err) {
        logger.error('Error handling WebSocket message', err);
        ws.send(JSON.stringify({ type: 'error', error: 'Failed to process message' }));
      }
    });

    ws.on('close', () => {
      presenceService.unregister(ws);
    });

    ws.on('error', (err) => {
      logger.error('WebSocket connection error', err);
      presenceService.unregister(ws);
    });
  });
}
