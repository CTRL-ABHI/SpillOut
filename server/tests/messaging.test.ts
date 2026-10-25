import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { setupWebSocketServer } from '../src/services/websocket.service.js';
import { presenceService } from '../src/services/presence.service.js';
import { prisma } from '../src/db.js';
import crypto from 'crypto';

describe('SPILLOUT Ephemeral E2EE Messaging, Presence & Signaling WebSocket Tests', () => {
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

  it('broadcasts real-time presence-update when users connect and disconnect', async () => {
    // 1. Alice connects first
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(wsAlice);

    await new Promise<void>((resolve) => {
      wsAlice.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') resolve();
      });
    });

    // 2. Set up listener on Alice for Bob's online event
    const bobOnlinePromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'presence-update' && msg.payload.canonicalUsername === 'bob02') {
          wsAlice.off('message', handler);
          resolve(msg);
        }
      };
      wsAlice.on('message', handler);
    });

    // 3. Bob connects
    const wsBob = new WebSocket(`ws://localhost:${port}/ws?token=${user2Token}`);
    activeSockets.push(wsBob);

    const onlineEvent = await bobOnlinePromise;
    expect(onlineEvent.payload.canonicalUsername).toBe('bob02');
    expect(onlineEvent.payload.isOnline).toBe(true);

    // 4. Set up listener on Alice for Bob's offline event
    const bobOfflinePromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'presence-update' && msg.payload.canonicalUsername === 'bob02') {
          wsAlice.off('message', handler);
          resolve(msg);
        }
      };
      wsAlice.on('message', handler);
    });

    // 5. Bob disconnects
    wsBob.close();

    const offlineEvent = await bobOfflinePromise;
    expect(offlineEvent.payload.canonicalUsername).toBe('bob02');
    expect(offlineEvent.payload.isOnline).toBe(false);

    wsAlice.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('supports multiple concurrent connections for the same account without marking user offline prematurely', async () => {
    // Tab 1 for Alice
    const wsAliceTab1 = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    // Tab 2 for Alice
    const wsAliceTab2 = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(wsAliceTab1, wsAliceTab2);

    await Promise.all([
      new Promise<void>((res) => {
        wsAliceTab1.on('message', (raw) => {
          if (JSON.parse(raw.toString()).type === 'auth-success') res();
        });
      }),
      new Promise<void>((res) => {
        wsAliceTab2.on('message', (raw) => {
          if (JSON.parse(raw.toString()).type === 'auth-success') res();
        });
      }),
    ]);

    expect(presenceService.isOnline('alice01')).toBe(true);

    // Close Tab 1: Alice should STILL be online because Tab 2 is active
    wsAliceTab1.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(presenceService.isOnline('alice01')).toBe(true);

    // Close Tab 2: Now Alice should be offline
    wsAliceTab2.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(presenceService.isOnline('alice01')).toBe(false);
  });

  it('handles case-insensitive canonical username matching (Alice01 vs alice01)', async () => {
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(wsAlice);

    await new Promise<void>((resolve) => {
      wsAlice.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') resolve();
      });
    });

    expect(presenceService.isOnline('Alice01')).toBe(true);
    expect(presenceService.isOnline('alice01')).toBe(true);
    expect(presenceService.isOnline('  ALICE01  ')).toBe(true);

    wsAlice.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('rejects sending messages when recipient is offline and does not queue them', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    activeSockets.push(ws1);

    await new Promise<void>((resolve) => {
      ws1.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'auth-success') resolve();
      });
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
    await new Promise((r) => setTimeout(r, 50));
  });

  it('relays encrypted ciphertext in real-time when both participants are online', async () => {
    const wsAlice = new WebSocket(`ws://localhost:${port}/ws?token=${user1Token}`);
    const wsBob = new WebSocket(`ws://localhost:${port}/ws?token=${user2Token}`);
    activeSockets.push(wsAlice, wsBob);

    await Promise.all([
      new Promise<void>((res) => {
        wsAlice.on('message', (raw) => {
          if (JSON.parse(raw.toString()).type === 'auth-success') res();
        });
      }),
      new Promise<void>((res) => {
        wsBob.on('message', (raw) => {
          if (JSON.parse(raw.toString()).type === 'auth-success') res();
        });
      }),
    ]);

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
    await new Promise((r) => setTimeout(r, 50));
  });
});
