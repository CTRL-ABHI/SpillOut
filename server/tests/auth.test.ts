import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { accountCleanupService } from '../src/services/account-cleanup.service.js';

const app = createApp();

describe('SPILLOUT Authentication & Inactivity Lifecycle Integration Tests', () => {
  beforeEach(async () => {
    // Clear sessions and users before each test
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('successfully registers an account with 3x3 matrix password and gender', async () => {
    const matrixPassword = ['A', 'b', '1', '!', ' ', '$', '9', 'z', '#'];
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'TestUser1',
        password: matrixPassword,
        confirmPassword: matrixPassword,
        gender: 'Female',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('TestUser1');
    expect(res.body.user.canonicalUsername).toBe('testuser1');
    expect(res.body.user.gender).toBe('Female');
    expect(res.body.token).toBeDefined();

    // Verify session cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('spillout_session=');
    expect(cookies[0]).toContain('HttpOnly');

    // Verify user in DB has NO plaintext password
    const dbUser = await prisma.user.findUnique({
      where: { canonicalUsername: 'testuser1' },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser?.passwordHash).toContain('$argon2id$');
    expect(dbUser?.passwordHash).not.toContain('Ab1! $9z#');
  });

  it('enforces case-insensitive username uniqueness (e.g. Abhi123 vs abhi123)', async () => {
    const matrix = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    // Register initial user with uppercase
    const first = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Abhi123',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Male',
      });
    expect(first.status).toBe(201);

    // Attempt to register with lowercase
    const second = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'abhi123',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Object',
      });
    expect(second.status).toBe(409);
    expect(second.body.error).toContain('already registered');
  });

  it('rejects passwords where confirmation matrix does not match', async () => {
    const original = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const different = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'x'];

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Mismatch',
        password: original,
        confirmPassword: different,
        gender: 'Object',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('do not match');
  });

  it('logs in successfully and rejects invalid credentials', async () => {
    const matrix = ['X', 'y', 'z', '!', ' ', '@', '1', '2', '3'];

    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'LoginUser',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Male',
      });

    // Valid login
    const validLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'loginuser',
        password: matrix,
      });

    expect(validLogin.status).toBe(200);
    expect(validLogin.body.user.username).toBe('LoginUser');

    // Invalid login password
    const wrongMatrix = ['X', 'y', 'z', '!', ' ', '@', '1', '2', '0'];
    const invalidLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'loginuser',
        password: wrongMatrix,
      });

    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error).toBe('Invalid username or password');
  });

  it('authenticates session via /api/auth/me and logs out cleanly', async () => {
    const matrix = ['1', '1', '1', '2', '2', '2', '3', '3', '3'];

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'SessUser',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Object',
      });

    expect(reg.status).toBe(201);
    const cookies = reg.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Verify /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies!);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.canonicalUsername).toBe('sessuser');

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies!);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Subsequent /api/auth/me should fail
    const postLogout = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies!);

    expect(postLogout.status).toBe(401);
  });

  it('permanently deletes accounts inactive for 7 consecutive days', async () => {
    const matrix = ['p', 'a', 's', 's', 'w', 'o', 'r', 'd', '1'];

    // 1. Create active user (lastActivityAt = now)
    const activeRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ActiveUser',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Male',
      });
    expect(activeRes.status).toBe(201);

    // 2. Create inactive user and simulate lastActivityAt = 8 days ago
    const inactiveRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ExpUser',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Female',
      });
    expect(inactiveRes.status).toBe(201);

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { canonicalUsername: 'expuser' },
      data: { lastActivityAt: eightDaysAgo },
    });

    // 3. Run account cleanup service
    const deletedCount = await accountCleanupService.cleanupExpiredAccounts();
    expect(deletedCount).toBe(1);

    // 4. Verify ActiveUser still exists
    const activeInDb = await prisma.user.findUnique({
      where: { canonicalUsername: 'activeuser' },
    });
    expect(activeInDb).not.toBeNull();

    // 5. Verify ExpUser was permanently deleted
    const expiredInDb = await prisma.user.findUnique({
      where: { canonicalUsername: 'expuser' },
    });
    expect(expiredInDb).toBeNull();

    // 6. Verify username is now free and can be re-registered
    const reRegister = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ExpUser',
        password: matrix,
        confirmPassword: matrix,
        gender: 'Object',
      });
    expect(reRegister.status).toBe(201);
    expect(reRegister.body.user.gender).toBe('Object');
  });
});
