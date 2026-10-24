import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, SESSION_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { presenceService } from '../services/presence.service.js';
import { accountCleanupService } from '../services/account-cleanup.service.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const accountRouter = Router();

/**
 * Get account security status and 7-day inactivity countdown
 */
accountRouter.get('/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const cutoff = accountCleanupService.getCutoffDate();
  const expirationDate = new Date(user.lastActivityAt.getTime() + config.inactivityExpirationDays * 24 * 60 * 60 * 1000);
  const msRemaining = Math.max(0, expirationDate.getTime() - Date.now());
  const hoursRemaining = Math.round(msRemaining / (1000 * 60 * 60));

  res.json({
    account: {
      username: user.username,
      canonicalUsername: user.canonicalUsername,
      gender: user.gender,
      createdAt: user.createdAt,
      lastActivityAt: user.lastActivityAt,
      expiresAt: expirationDate,
      hoursUntilInactivityDeletion: hoursRemaining,
      policy: 'Account is permanently deleted after 7 consecutive days of inactivity',
    },
  });
});

/**
 * Delete account manually and immediately
 */
accountRouter.delete('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  try {
    // 1. Evict active presence and WebSockets
    presenceService.disconnectUser(user.canonicalUsername, 'Account deleted by user');

    // 2. Delete user and sessions
    await prisma.user.delete({
      where: { id: user.id },
    });

    // 3. Clear cookie
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'strict' : 'lax',
      path: '/',
    });

    logger.info(`User voluntarily deleted their account: ${user.canonicalUsername}`);

    res.json({
      success: true,
      message: 'Account permanently deleted. All credentials and sessions removed.',
    });
  } catch (err) {
    logger.error('Failed to delete account', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});
