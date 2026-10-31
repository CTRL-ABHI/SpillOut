import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, SESSION_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { getSessionCookieOptions } from './auth.js';
import { presenceService } from '../services/presence.service.js';
import { accountCleanupService } from '../services/account-cleanup.service.js';
import { validateAvatarId } from '../utils/validation.js';
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
      avatarId: user.avatarId || null,
      createdAt: user.createdAt,
      lastActivityAt: user.lastActivityAt,
      expiresAt: expirationDate,
      hoursUntilInactivityDeletion: hoursRemaining,
      policy: 'Account is permanently deleted after 7 consecutive days of inactivity',
    },
  });
});

/**
 * Update doodle character profile avatar
 */
accountRouter.post('/avatar', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { avatarId } = req.body;
  const validation = validateAvatarId(avatarId);

  if (!validation.isValid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarId: validation.data },
      select: {
        id: true,
        username: true,
        canonicalUsername: true,
        gender: true,
        avatarId: true,
      },
    });

    res.json({
      success: true,
      avatarId: updated.avatarId,
      user: updated,
    });
  } catch (err) {
    logger.error('Failed to update avatar', err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
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
    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());

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
