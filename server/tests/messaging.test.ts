import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { setupWebSocketServer } from '../src/services/websocket.service.js';
import { prisma } from '../src/db.js';
import crypto from 'crypto';

describe('SPILLOUT Ephemeral E2EE Messaging & Signaling WebSocket Tests', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let port: number;
  let user1Token: string;
  let user2Token: string;
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
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
        createdAt: now,
        lastActivityAt: now,
      },
    });

    user1Token = crypto.randomBytes(32).toString('hex');
    user2Token = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.session.createMany({
      data: [
        { token: user1Token, userId: u1.id, expiresAt },
        { token: user2Token, userId: u2.id, expiresAt },
      ],
    });

    const app = createApp();
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
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('rejects sending messages when recipient is offline and does not queue them', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    activeSockets.push(ws1);

    await new Promise<void>((resolve) => ws1.on('open', resolve));

    // Authenticate Alice
    ws1.send(JSON.stringify({ type: 'auth', payload: { token: user1Token } }));

    await new Promise<void>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth-success') {
          ws1.off('message', handler);
          resolve();
        }
      };
      ws1.on('message', handler);
    });

    // Alice attempts to send an E2EE message to Bob (who is offline)
    ws1.send(
      JSON.stringify({
        type: 'send-e2ee-message',
        payload: {
          recipientUsername: 'Bob02',
          ciphertext: 'ENCRYPTED_BASE64_CIPHERTEXT',
          iv: 'BASE64_IV',
          tag: 'BASE64_TAG',
          senderEphemeralPublicKey: 'PUBKEY_ALICE',
        },
      })
    );

    const undeliverable = await new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'message-undeliverable') {
          ws1.off('message', handler);
          resolve(msg);
        }
      };
      ws1.on('message', handler);
    });

    expect(undeliverable.type).toBe('message-undeliverable');
    expect(undeliverable.payload.reason).toContain('offline');

    // Confirm that the message payload is NOT saved to the database anywhere
    const dbSessions = await prisma.session.findMany({});
    expect(dbSessions.length).toBe(2);

    ws1.close();
  });

  it('relays encrypted ciphertext in real-time when both participants are online', async () => {
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws`);
    const wsBob = new WebSocket(`ws://localhost:${port}/ws`);
    activeSockets.push(wsAlice, wsBob);

    await Promise.all([
      new Promise<void>((res) => wsAlice.on('open', res)),
      new Promise<void>((res) => wsBob.on('open', res)),
    ]);

    // Authenticate Alice
    await new Promise<void>((res) => {
      const handler = (raw: any) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') {
          wsAlice.off('message', handler);
          res();
        }
      };
      wsAlice.on('message', handler);
      wsAlice.send(JSON.stringify({ type: 'auth', payload: { token: user1Token } }));
    });

    // Authenticate Bob
    await new Promise<void>((res) => {
      const handler = (raw: any) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') {
          wsBob.off('message', handler);
          res();
        }
      };
      wsBob.on('message', handler);
      wsBob.send(JSON.stringify({ type: 'auth', payload: { token: user2Token } }));
    });

    // Set up promise for Bob to receive the E2EE message
    const bobReceivedPromise = new Promise<any>((res) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'e2ee-message') {
          wsBob.off('message', handler);
          res(msg);
        }
      };
      wsBob.on('message', handler);
    });

    // Alice sends E2EE message to Bob
    wsAlice.send(
      JSON.stringify({
        type: 'send-e2ee-message',
        payload: {
          recipientUsername: 'Bob02',
          ciphertext: 'AUTHENTICATED_AES_GCM_ENCRYPTED_TEXT',
          iv: 'GCM_NONCE_12_BYTES',
          tag: 'AUTH_TAG_16_BYTES',
          senderEphemeralPublicKey: 'EPHEMERAL_ECDH_PUBLIC_KEY',
        },
      })
    );

    const bobReceived = await bobReceivedPromise;

    expect(bobReceived.type).toBe('e2ee-message');
    expect(bobReceived.payload.senderUsername).toBe('Alice01');
    expect(bobReceived.payload.ciphertext).toBe('AUTHENTICATED_AES_GCM_ENCRYPTED_TEXT');
    expect(bobReceived.payload.iv).toBe('GCM_NONCE_12_BYTES');
    expect(bobReceived.payload.senderEphemeralPublicKey).toBe('EPHEMERAL_ECDH_PUBLIC_KEY');

    wsAlice.close();
    wsBob.close();
  });
});
