import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupWebSocketServer } from '../src/services/websocket.service.js';
import { presenceService } from '../src/services/presence.service.js';
import { messageService } from '../src/services/message.service.js';
import { conversationService } from '../src/services/conversation.service.js';
import { callService } from '../src/services/call.service.js';
import { prisma } from '../src/db.js';
import crypto from 'crypto';

describe('SPILLOUT Reliable E2EE Messaging, 24h Retention & Acknowledgements Tests', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let app: any;
  let port: number;
  let user1Token: string;
  let user2Token: string;
  let u1Id: string;
  let u2Id: string;
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});

    // Create 2 test users in DB
    const now = new Date();
    const u1 = await prisma.user.create({
      data: {
        username: 'Alice01',
        canonicalUsername: 'alice01',
        passwordHash: 'dummy_hash_1',
        gender: 'Female',
        avatarId: 'avatar_01',
        createdAt: now,
        lastActivityAt: now,
      },
    });

    const u2 = await prisma.user.create({
      data: {
        username: 'Bob02',
        canonicalUsername: 'bob02',
        passwordHash: 'dummy_hash_2',
        gender: 'Male',
        avatarId: 'avatar_02',
        createdAt: now,
        lastActivityAt: now,
      },
    });

    u1Id = u1.id;
    u2Id = u2.id;
    user1Token = crypto.randomBytes(32).toString('hex');
    user2Token = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.session.createMany({
      data: [
        { token: user1Token, userId: u1.id, expiresAt },
        { token: user2Token, userId: u2.id, expiresAt },
      ],
    });

    app = createApp();
    server = http.createServer(app);
    wss = new WebSocketServer({ server, path: '/ws' });
    setupWebSocketServer(wss);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }
    if (wss) {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      await prisma.message.deleteMany({});
      await prisma.conversation.deleteMany({});
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
      await prisma.$disconnect();
    } catch {}
  });

  it('authenticates via URL query parameter ?token=... immediately upon connection', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(ws);

    const authSuccessPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth-success') {
          resolve(msg);
        }
      });
    });

    const msg = await authSuccessPromise;
    expect(msg.type).toBe('auth-success');
    expect(msg.payload.canonicalUsername).toBe('alice01');
    expect(msg.payload.avatarId).toBe('avatar_01');
    expect(presenceService.isOnline('alice01')).toBe(true);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(presenceService.isOnline('alice01')).toBe(false);
  });

  it('sends presence-snapshot of all currently online users upon authentication', async () => {
    // 1. Connect and authenticate Bob first
    const wsBob = new WebSocket(`ws://localhost:${port}/ws?token=${user2Token}`);
    activeSockets.push(wsBob);

    await new Promise<void>((resolve) => {
      wsBob.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') resolve();
      });
    });

    expect(presenceService.isOnline('bob02')).toBe(true);

    // 2. Connect Alice and verify she receives presence-snapshot containing bob02
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(wsAlice);

    const snapshotPromise = new Promise<any>((resolve) => {
      wsAlice.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'presence-snapshot') resolve(msg);
      });
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.payload.onlineUsers).toContain('bob02');

    wsBob.close();
    wsAlice.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('queues encrypted messages when recipient is offline with 24-hour expiration', async () => {
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(wsAlice);

    await new Promise<void>((resolve) => {
      wsAlice.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') resolve();
      });
    });

    expect(presenceService.isOnline('bob02')).toBe(false);

    // Alice sends message to Bob (who is offline)
    const testMsgId = `test_offline_${Date.now()}`;

    // Register listener before sending to avoid race conditions
    const sentAckPromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'message-sent' && msg.payload.messageId === testMsgId) {
          wsAlice.off('message', handler);
          resolve(msg);
        }
      };
      wsAlice.on('message', handler);
    });

    wsAlice.send(
      JSON.stringify({
        type: 'send-e2ee-message',
        payload: {
          id: testMsgId,
          recipientUsername: 'Bob02',
          ciphertext: 'ENCRYPTED_PAYLOAD_FOR_OFFLINE_BOB',
          iv: 'GCM_NONCE_12_BYTES',
          senderEphemeralPublicKey: 'PUBKEY_ALICE',
        },
      })
    );

    // Alice should receive 'message-sent' acknowledgement from server
    const sentAck = await sentAckPromise;

    expect(sentAck.type).toBe('message-sent');
    expect(sentAck.payload.status).toBe('sent');
    expect(sentAck.payload.recipientCanonical).toBe('bob02');

    // Verify stored in DB with 24h expiration
    const storedMsg = await prisma.message.findUnique({
      where: { id: testMsgId },
    });

    expect(storedMsg).toBeDefined();
    expect(storedMsg?.status).toBe('sent');
    expect(storedMsg?.ciphertext).toBe('ENCRYPTED_PAYLOAD_FOR_OFFLINE_BOB');
    // Confirm expiresAt is ~24 hours from createdAt
    const diffHours = (storedMsg!.expiresAt.getTime() - storedMsg!.createdAt.getTime()) / (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(24);

    wsAlice.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('delivers unexpired queued messages to recipient upon reconnection and handles acknowledgements', async () => {
    // Bob now connects. He should immediately receive the queued message sent by Alice!
    const wsBob = new WebSocket(`ws://localhost:${port}/ws?token=${user2Token}`);
    activeSockets.push(wsBob);

    const receivedMessage = await new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'e2ee-message' && msg.payload.ciphertext === 'ENCRYPTED_PAYLOAD_FOR_OFFLINE_BOB') {
          wsBob.off('message', handler);
          resolve(msg);
        }
      };
      wsBob.on('message', handler);
    });

    expect(receivedMessage.type).toBe('e2ee-message');
    expect(receivedMessage.payload.ciphertext).toBe('ENCRYPTED_PAYLOAD_FOR_OFFLINE_BOB');

    // Bob acknowledges receipt
    wsBob.send(
      JSON.stringify({
        type: 'message-ack',
        payload: {
          messageId: receivedMessage.payload.id,
        },
      })
    );

    // Wait for DB to update status to 'delivered'
    await new Promise((r) => setTimeout(r, 150));

    const updated = await prisma.message.findUnique({
      where: { id: receivedMessage.payload.id },
    });

    expect(updated?.status).toBe('delivered');
    expect(updated?.deliveredAt).toBeDefined();

    wsBob.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('retrieves conversation message history via REST API within the 24-hour window', async () => {
    const res = await request(app)
      .get('/api/messages/bob02')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.messages[0].ciphertext).toBe('ENCRYPTED_PAYLOAD_FOR_OFFLINE_BOB');
  });

  it('excludes expired messages and purges them during retention cleanup', async () => {
    // Insert an artificially expired message (> 24 hours old)
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const expiredId = `expired_msg_${Date.now()}`;

    await prisma.message.create({
      data: {
        id: expiredId,
        conversationId: 'alice01:bob02',
        senderCanonical: 'alice01',
        recipientCanonical: 'bob02',
        ciphertext: 'ANCIENT_CIPHERTEXT',
        iv: 'OLD_IV',
        senderEphemeralPublicKey: 'PUBKEY_ALICE',
        createdAt: oldDate,
        expiresAt: new Date(oldDate.getTime() + 24 * 60 * 60 * 1000), // Expired 1 hour ago
        status: 'sent',
      },
    });

    // 1. Verify GET /api/messages/:username excludes it
    const res = await request(app)
      .get('/api/messages/bob02')
      .set('Authorization', `Bearer ${user1Token}`);

    const hasExpired = res.body.messages.some((m: any) => m.id === expiredId);
    expect(hasExpired).toBe(false);

    // 2. Run message cleanup task
    const deletedCount = await messageService.cleanupExpiredMessages();
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // 3. Confirm physically deleted from DB
    const checkDb = await prisma.message.findUnique({
      where: { id: expiredId },
    });
    expect(checkDb).toBeNull();
  });

  it('maintains persistent conversation metadata in GET /api/conversations even after messages expire', async () => {
    // 1. Explicitly touch/create conversation relationship
    await conversationService.touchConversation('alice01', 'bob02');

    // 2. Fetch conversations for Alice
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toBeDefined();
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.conversations.length).toBeGreaterThan(0);

    const bobEntry = res.body.conversations.find((c: any) => c.canonicalUsername === 'bob02');
    expect(bobEntry).toBeDefined();
    expect(bobEntry.username).toBe('Bob02');
    expect(bobEntry.avatarId).toBe('avatar_02');

    // 3. Purge all messages in database to simulate total 24h message expiration
    await prisma.message.deleteMany({});

    // 4. Verify conversation STILL exists in conversation list
    const resAfterExpiry = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(resAfterExpiry.status).toBe(200);
    const bobStillExists = resAfterExpiry.body.conversations.find((c: any) => c.canonicalUsername === 'bob02');
    expect(bobStillExists).toBeDefined();
  });

  it('manages authoritative voice call state, rejects calls with "User is on another call", and frees users upon end', async () => {
    const callId1 = `test_call_${Date.now()}_1`;

    // 1. Alice reserves a call to Bob
    const res1 = callService.reserveCall(
      callId1,
      'alice01',
      'Alice01',
      'bob02',
      'Bob02',
      () => {}
    );
    expect(res1.success).toBe(true);
    expect(callService.isUserBusy('bob02')).toBe(true);
    expect(callService.isUserBusy('alice01')).toBe(true);

    // 2. Third user tries to call Bob while Bob is busy
    const callId2 = `test_call_${Date.now()}_2`;
    const res2 = callService.reserveCall(
      callId2,
      'charlie03',
      'Charlie03',
      'bob02',
      'Bob02',
      () => {}
    );
    expect(res2.success).toBe(false);
    expect(res2.reason).toBe('User is on another call');

    // 3. Bob accepts Alice's call
    const accepted = callService.acceptCall(callId1, 'bob02');
    expect(accepted).not.toBeNull();
    expect(accepted?.status).toBe('connected');

    // 4. Call ends
    const released = callService.releaseCall(callId1, 'Call ended');
    expect(released).not.toBeNull();
    expect(released?.status).toBe('ended');

    // 5. Verify both Alice and Bob are immediately freed
    expect(callService.isUserBusy('bob02')).toBe(false);
    expect(callService.isUserBusy('alice01')).toBe(false);

    // 6. Charlie can now successfully call Bob
    const res3 = callService.reserveCall(
      callId2,
      'charlie03',
      'Charlie03',
      'bob02',
      'Bob02',
      () => {}
    );
    expect(res3.success).toBe(true);
    expect(callService.isUserBusy('bob02')).toBe(true);

    // Clean up
    callService.releaseCall(callId2, 'Test cleanup');
    expect(callService.isUserBusy('bob02')).toBe(false);
  });
});
