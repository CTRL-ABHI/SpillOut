import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { prisma } from '../db.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { presenceService, ConnectedClient } from './presence.service.js';
import { accountCleanupService } from './account-cleanup.service.js';
import { messageService } from './message.service.js';
import { conversationService } from './conversation.service.js';
import { callService } from './call.service.js';
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
  // Stale connection cleanup loop (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((clientWs) => {
      if ((clientWs as any).isAlive === false) {
        logger.debug('Terminating dead/unresponsive WebSocket client');
        presenceService.unregister(clientWs);
        return clientWs.terminate();
      }
      (clientWs as any).isAlive = false;
      try {
        clientWs.ping();
      } catch {
        // Socket may have closed
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    logger.debug('New incoming WebSocket connection attempt');

    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    let currentClient: ConnectedClient | null = null;

    // 1. Try extracting session token from cookie
    let token: string | undefined;
    if (req.headers.cookie) {
      const parsedCookies = parseCookies(req.headers.cookie);
      token = parsedCookies[SESSION_COOKIE_NAME];
    }

    // 2. If no cookie, try extracting from URL query parameters (?token=...)
    if (!token && req.url) {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const queryToken = parsedUrl.searchParams.get('token');
        if (queryToken) {
          token = queryToken;
        }
      } catch {
        // Ignore URL parse errors
      }
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

        const canonical = (session.user.canonicalUsername || session.user.username).toLowerCase().trim();

        currentClient = {
          ws,
          userId: session.user.id,
          username: session.user.username,
          canonicalUsername: canonical,
          connectedAt: new Date(),
        };

        presenceService.register(currentClient);

        // A. Confirm authentication to the client
        ws.send(
          JSON.stringify({
            type: 'auth-success',
            payload: {
              username: session.user.username,
              canonicalUsername: canonical,
              avatarId: session.user.avatarId,
            },
          })
        );

        // B. Send initial snapshot of all currently online users to this newly connected client
        const onlineUsers = presenceService.getOnlineUsers();
        ws.send(
          JSON.stringify({
            type: 'presence-snapshot',
            payload: {
              onlineUsers,
            },
          })
        );

        // C. Deliver any pending unexpired messages that arrived while offline
        try {
          const pending = await messageService.getPendingMessagesForRecipient(canonical);
          if (pending.length > 0) {
            for (const m of pending) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'e2ee-message',
                    payload: {
                      id: m.id,
                      senderUsername: m.senderCanonical,
                      senderCanonical: m.senderCanonical,
                      recipientCanonical: m.recipientCanonical,
                      ciphertext: m.ciphertext,
                      iv: m.iv,
                      tag: m.tag,
                      senderEphemeralPublicKey: m.senderEphemeralPublicKey,
                      timestamp: m.createdAt.toISOString(),
                      status: m.status,
                    },
                  })
                );
              }
            }
          }
        } catch (queueErr) {
          logger.warn('Error delivering pending messages on connection', queueErr);
        }

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

        // Keep connection marked alive on any inbound message
        (ws as any).isAlive = true;

        // 1. Initial auth message if token was provided in-message
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

        // 4. Reliable End-to-End Encrypted Messaging (24-Hour Expiration & Delivery Queue)
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

          const messageId = payload.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          // Verify recipient exists in database
          const recipientUser = await prisma.user.findUnique({
            where: { canonicalUsername: recipientCanonical },
            select: { id: true, username: true, canonicalUsername: true },
          });

          if (!recipientUser) {
            ws.send(
              JSON.stringify({
                type: 'message-failed',
                payload: {
                  messageId,
                  recipient: payload.recipientUsername,
                  reason: 'Recipient username does not exist.',
                },
              })
            );
            return;
          }

          // Persist encrypted ciphertext with 24-hour expiration window
          const stored = await messageService.createMessage({
            id: messageId,
            senderCanonical: currentClient.canonicalUsername,
            recipientCanonical,
            ciphertext: payload.ciphertext,
            iv: payload.iv,
            tag: payload.tag,
            senderEphemeralPublicKey: payload.senderEphemeralPublicKey,
          });

          // Touch persistent conversation relationship (independent of message expiration)
          await conversationService.touchConversation(currentClient.canonicalUsername, recipientCanonical);

          // Confirm to sender that message is accepted and stored (status: 'sent')
          ws.send(
            JSON.stringify({
              type: 'message-sent',
              payload: {
                messageId: stored.id,
                recipient: recipientUser.username,
                recipientCanonical,
                timestamp: stored.createdAt.toISOString(),
                expiresAt: stored.expiresAt.toISOString(),
                status: 'sent',
              },
            })
          );

          // If recipient is currently online, dispatch immediately to recipient's open sockets
          if (presenceService.isOnline(recipientCanonical)) {
            const recipientSockets = presenceService.getSockets(recipientCanonical);
            const relayMessage = JSON.stringify({
              type: 'e2ee-message',
              payload: {
                id: stored.id,
                senderUsername: currentClient.username,
                senderCanonical: currentClient.canonicalUsername,
                recipientCanonical,
                ciphertext: stored.ciphertext,
                iv: stored.iv,
                tag: stored.tag,
                senderEphemeralPublicKey: stored.senderEphemeralPublicKey,
                timestamp: stored.createdAt.toISOString(),
                status: stored.status,
              },
            });

            for (const s of recipientSockets) {
              if (s.readyState === WebSocket.OPEN) {
                s.send(relayMessage);
              }
            }
          }

          // Update qualifying activity on chat action
          markQualifyingActivity();
          return;
        }

        // 5. Message Delivery Acknowledgement (Recipient client -> Server -> Sender)
        if (type === 'message-ack') {
          const messageId = payload?.messageId;
          if (messageId) {
            const updated = await messageService.markMessageDelivered(messageId, currentClient.canonicalUsername);
            if (updated) {
              // Notify sender of successful delivery
              const senderSockets = presenceService.getSockets(updated.senderCanonical);
              const deliveredNotice = JSON.stringify({
                type: 'message-delivered',
                payload: {
                  messageId: updated.id,
                  recipientCanonical: currentClient.canonicalUsername,
                  deliveredAt: updated.deliveredAt?.toISOString() || new Date().toISOString(),
                  status: 'delivered',
                },
              });

              for (const s of senderSockets) {
                if (s.readyState === WebSocket.OPEN) {
                  s.send(deliveredNotice);
                }
              }
            }
          }
          return;
        }

        // 6. WebRTC Signaling for Encrypted Voice Calls (Backed by Authoritative Call Registry)
        if (type === 'webrtc-signal') {
          const signalType = payload?.signalType; // call-invite, call-accept, call-decline, call-cancel, call-busy, call-end, webrtc-offer, webrtc-answer, webrtc-ice
          const target = payload?.targetUsername?.toLowerCase()?.trim();
          const callId = payload?.callId;

          if (!target || !signalType) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid signaling payload' }));
            return;
          }

          if (!presenceService.isOnline(target)) {
            if (callId) {
              callService.releaseCall(callId, 'Recipient offline');
            }
            ws.send(
              JSON.stringify({
                type: 'call-failed',
                payload: {
                  target,
                  callId,
                  reason: 'User is currently offline',
                },
              })
            );
            return;
          }

          // Authoritative call state machine validation
          if (signalType === 'call-invite') {
            const recipientUser = await prisma.user.findUnique({
              where: { canonicalUsername: target },
              select: { username: true },
            });

            const effectiveCallId = callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const reservation = callService.reserveCall(
              effectiveCallId,
              currentClient.canonicalUsername,
              currentClient.username,
              target,
              recipientUser?.username || target,
              (timeoutSession) => {
                const timeoutPayload = JSON.stringify({
                  type: 'call-failed',
                  payload: {
                    callId: timeoutSession.callId,
                    reason: 'No answer from recipient (call timed out)',
                  },
                });
                for (const s of [
                  ...presenceService.getSockets(timeoutSession.callerCanonical),
                  ...presenceService.getSockets(timeoutSession.recipientCanonical),
                ]) {
                  if (s.readyState === WebSocket.OPEN) s.send(timeoutPayload);
                }
              }
            );

            if (!reservation.success) {
              ws.send(
                JSON.stringify({
                  type: 'call-failed',
                  payload: {
                    target,
                    callId: effectiveCallId,
                    reason: reservation.reason || 'User is on another call',
                  },
                })
              );
              return;
            }

            // Also record conversation relationship
            await conversationService.touchConversation(currentClient.canonicalUsername, target);
          } else if (signalType === 'call-accept') {
            if (callId) {
              callService.acceptCall(callId, currentClient.canonicalUsername);
            }
          } else if (signalType === 'call-decline' || signalType === 'call-busy') {
            if (callId) {
              callService.releaseCall(callId, `Call ${signalType} by recipient`);
            }
          } else if (signalType === 'call-cancel') {
            if (callId) {
              callService.releaseCall(callId, 'Call cancelled by caller');
            }
          } else if (signalType === 'call-end') {
            if (callId) {
              callService.releaseCall(callId, 'Call ended by participant');
            }
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
      const client = presenceService.unregister(ws);
      if (client && !presenceService.isOnline(client.canonicalUsername)) {
        const disconnected = callService.handleUserDisconnected(client.canonicalUsername);
        if (disconnected && disconnected.peerCanonical) {
          const peerSockets = presenceService.getSockets(disconnected.peerCanonical);
          const endNotice = JSON.stringify({
            type: 'webrtc-signal',
            payload: {
              signalType: 'call-end',
              callId: disconnected.callId,
              reason: 'Peer disconnected',
            },
          });
          for (const s of peerSockets) {
            if (s.readyState === WebSocket.OPEN) s.send(endNotice);
          }
        }
      }
    });

    ws.on('error', (err: unknown) => {
      logger.error('WebSocket connection error', err);
      const client = presenceService.unregister(ws);
      if (client && !presenceService.isOnline(client.canonicalUsername)) {
        const disconnected = callService.handleUserDisconnected(client.canonicalUsername);
        if (disconnected && disconnected.peerCanonical) {
          const peerSockets = presenceService.getSockets(disconnected.peerCanonical);
          const endNotice = JSON.stringify({
            type: 'webrtc-signal',
            payload: {
              signalType: 'call-end',
              callId: disconnected.callId,
              reason: 'Peer connection error',
            },
          });
          for (const s of peerSockets) {
            if (s.readyState === WebSocket.OPEN) s.send(endNotice);
          }
        }
      }
    });
  });
}
