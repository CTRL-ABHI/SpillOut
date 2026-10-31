import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import {
  validateUsername,
  validateGender,
  validateMatrixPassword,
  validateAvatarId,
} from '../utils/validation.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { authRateLimiter, searchRateLimiter } from '../middleware/rate-limiter.middleware.js';
import {
  authMiddleware,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.middleware.js';
import { presenceService } from '../services/presence.service.js';
import { accountCleanupService } from '../services/account-cleanup.service.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

// Helper to resolve consistent cookie security options
export function getSessionCookieOptions(expiresAt?: Date) {
  const isCrossSite = process.env.ALLOW_CROSS_SITE_COOKIES === 'true';
  return {
    httpOnly: true,
    secure: config.isProduction || isCrossSite,
    sameSite: (isCrossSite ? 'none' : (config.isProduction ? 'strict' : 'lax')) as 'none' | 'strict' | 'lax',
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

// Helper to set session cookie
function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

/**
 * Check username availability
 */
authRouter.get('/check-username', searchRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const raw = req.query.username;
  const validation = validateUsername(raw);

  if (!validation.isValid || !validation.data) {
    res.json({
      valid: false,
      available: false,
      error: validation.error,
    });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { canonicalUsername: validation.data.canonical },
      select: { id: true },
    });

    res.json({
      valid: true,
      available: !existing,
    });
  } catch (err) {
    logger.error('Error checking username', err);
    res.status(500).json({ error: 'Failed to verify username availability' });
  }
});

/**
 * Register a new account
 */
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password, confirmPassword, gender, publicKey, avatarId } = req.body;

  // 1. Validate username
  const userValidation = validateUsername(username);
  if (!userValidation.isValid || !userValidation.data) {
    res.status(400).json({ error: userValidation.error });
    return;
  }

  // 2. Validate gender
  const genderValidation = validateGender(gender);
  if (!genderValidation.isValid || !genderValidation.data) {
    res.status(400).json({ error: genderValidation.error });
    return;
  }

  // 3. Validate optional avatarId
  const avatarValidation = validateAvatarId(avatarId);
  if (!avatarValidation.isValid) {
    res.status(400).json({ error: avatarValidation.error });
    return;
  }

  // 4. Validate password matrix
  const pwdValidation = validateMatrixPassword(password);
  if (!pwdValidation.isValid || !pwdValidation.data) {
    res.status(400).json({ error: pwdValidation.error });
    return;
  }

  // 5. Validate confirm password matrix
  const confirmValidation = validateMatrixPassword(confirmPassword);
  if (!confirmValidation.isValid || !confirmValidation.data) {
    res.status(400).json({ error: 'Invalid password confirmation matrix' });
    return;
  }

  if (pwdValidation.data !== confirmValidation.data) {
    res.status(400).json({ error: 'Passwords entered in the matrix do not match' });
    return;
  }

  const { raw: rawUsername, canonical: canonicalUsername } = userValidation.data;

  try {
    // 6. Enforce uniqueness in DB
    const existing = await prisma.user.findUnique({
      where: { canonicalUsername },
    });

    if (existing) {
      res.status(409).json({ error: 'Username is already registered' });
      return;
    }

    // 7. Hash password using Argon2id
    const passwordHash = await hashPassword(pwdValidation.data);

    // 8. Create user
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        username: rawUsername,
        canonicalUsername,
        passwordHash,
        gender: genderValidation.data,
        avatarId: avatarValidation.data || null,
        publicKey: typeof publicKey === 'string' ? publicKey : null,
        createdAt: now,
        lastActivityAt: now,
      },
    });

    // 9. Generate session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000);

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
      },
    });

    setSessionCookie(res, sessionToken, expiresAt);

    logger.info(`New user registered: ${canonicalUsername}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        canonicalUsername: user.canonicalUsername,
        gender: user.gender,
        avatarId: user.avatarId,
        publicKey: user.publicKey,
        createdAt: user.createdAt,
        lastActivityAt: user.lastActivityAt,
      },
      token: sessionToken,
    });
  } catch (err: any) {
    // Catch database unique constraint error if race condition occurred
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }
    logger.error('Registration failed', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * Log in
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  const userValidation = validateUsername(username);
  const pwdValidation = validateMatrixPassword(password);

  if (!userValidation.isValid || !userValidation.data || !pwdValidation.isValid || !pwdValidation.data) {
    res.status(400).json({ error: 'Invalid username or password format' });
    return;
  }

  const { canonical: canonicalUsername } = userValidation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { canonicalUsername },
    });

    // Uniform response time / message against timing & enumeration attacks
    if (!user) {
      // Simulate verification computation
      await hashPassword('dummy_password_timing_defense');
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check 7-day inactivity
    const cutoff = accountCleanupService.getCutoffDate();
    if (user.lastActivityAt < cutoff) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      res.status(401).json({
        error: 'Account expired and deleted after 7 days of inactivity',
        code: 'ACCOUNT_EXPIRED',
      });
      return;
    }

    // Verify Argon2id password
    const isMatch = await verifyPassword(pwdValidation.data, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const now = new Date();
    // Update lastActivityAt on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActivityAt: now },
    });

    // Create new session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000);

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
      },
    });

    setSessionCookie(res, sessionToken, expiresAt);

    logger.info(`User logged in: ${canonicalUsername}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        canonicalUsername: user.canonicalUsername,
        gender: user.gender,
        avatarId: user.avatarId,
        publicKey: user.publicKey,
        createdAt: user.createdAt,
        lastActivityAt: now,
      },
      token: sessionToken,
    });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Get current authenticated user
 */
authRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  res.json({
    user: req.user,
    token: req.sessionToken,
  });
});

/**
 * Log out
 */
authRouter.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.sessionToken) {
      await prisma.session.delete({
        where: { token: req.sessionToken },
      }).catch(() => {});
    }

    if (req.user) {
      presenceService.disconnectUser(req.user.canonicalUsername, 'Logged out');
    }

    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());

    logger.info(`User logged out: ${req.user?.canonicalUsername}`);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Update user public key (for E2EE key establishment)
 */
authRouter.post('/public-key', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { publicKey } = req.body;
  if (!publicKey || typeof publicKey !== 'string') {
    res.status(400).json({ error: 'Valid public key string required' });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { publicKey },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update public key', err);
    res.status(500).json({ error: 'Failed to update key' });
  }
});

/**
 * Resolve recipient public key and presence
 */
authRouter.get('/user/:username/public-key', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const canonical = username.toLowerCase().trim();

  try {
    const targetUser = await prisma.user.findUnique({
      where: { canonicalUsername: canonical },
      select: {
        id: true,
        username: true,
        canonicalUsername: true,
        gender: true,
        avatarId: true,
        publicKey: true,
      },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isOnline = presenceService.isOnline(canonical);

    res.json({
      user: {
        username: targetUser.username,
        canonicalUsername: targetUser.canonicalUsername,
        gender: targetUser.gender,
        avatarId: targetUser.avatarId,
        publicKey: targetUser.publicKey,
        isOnline,
      },
    });
  } catch (err) {
    logger.error('Failed to fetch user public key', err);
    res.status(500).json({ error: 'Error resolving user' });
  }
});
