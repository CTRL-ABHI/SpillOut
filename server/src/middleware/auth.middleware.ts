import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { accountCleanupService } from '../services/account-cleanup.service.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  canonicalUsername: string;
  gender: string;
  avatarId?: string | null;
  publicKey?: string | null;
  createdAt: Date;
  lastActivityAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

export const SESSION_COOKIE_NAME = 'spillout_session';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token =
    req.cookies?.[SESSION_COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({ error: 'Invalid or revoked session' });
      return;
    }

    const now = new Date();

    // 1. Check session expiration
    if (session.expiresAt <= now) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({ error: 'Session has expired' });
      return;
    }

    // 2. Check 7-day inactivity policy
    const cutoff = accountCleanupService.getCutoffDate();
    if (session.user.lastActivityAt < cutoff) {
      logger.info(`User account ${session.user.canonicalUsername} expired (> 7 days inactive). Deleting account.`);
      await prisma.user.delete({ where: { id: session.user.id } }).catch(() => {});
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({
        error: 'Account permanently deleted due to 7 days of inactivity',
        code: 'ACCOUNT_EXPIRED',
      });
      return;
    }

    // 3. Update lastActivityAt on qualifying activity
    // Throttle database update to once every 5 minutes to avoid excessive DB writes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.user.lastActivityAt < fiveMinutesAgo) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { lastActivityAt: now },
      }).catch((err: unknown) => {
        logger.error('Failed to update lastActivityAt', err);
      });
      session.user.lastActivityAt = now;
    }

    req.user = {
      id: session.user.id,
      username: session.user.username,
      canonicalUsername: session.user.canonicalUsername,
      gender: session.user.gender,
      avatarId: session.user.avatarId,
      publicKey: session.user.publicKey,
      createdAt: session.user.createdAt,
      lastActivityAt: session.user.lastActivityAt,
    };
    req.sessionToken = token;

    next();
  } catch (err) {
    logger.error('Authentication middleware failure', err);
    res.status(500).json({ error: 'Internal security error' });
  }
}
