import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { conversationService } from '../services/conversation.service.js';
import { prisma } from '../db.js';
import { presenceService } from '../services/presence.service.js';
import { logger } from '../utils/logger.js';

export const conversationRouter = Router();

/**
 * List all persistent conversation relationships for the authenticated user.
 * Persists independently of 24-hour message expiration.
 */
conversationRouter.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const currentCanonical = req.user!.canonicalUsername;

  try {
    const list = await conversationService.listUserConversations(currentCanonical);
    res.json({ conversations: list });
  } catch (err) {
    logger.error('Failed to get conversations', err);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

/**
 * Create or touch a conversation relationship with another user.
 */
conversationRouter.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const currentCanonical = req.user!.canonicalUsername;
  const target = (req.body?.targetUsername || '').toLowerCase().trim();

  if (!target) {
    res.status(400).json({ error: 'targetUsername is required' });
    return;
  }

  if (target === currentCanonical) {
    res.status(400).json({ error: 'Cannot create a conversation with yourself' });
    return;
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { canonicalUsername: target },
      select: {
        id: true,
        username: true,
        canonicalUsername: true,
        avatarId: true,
        gender: true,
        publicKey: true,
        lastActivityAt: true,
      },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User does not exist' });
      return;
    }

    await conversationService.touchConversation(currentCanonical, target);
    const convId = conversationService.getConversationId(currentCanonical, target);

    res.json({
      success: true,
      conversation: {
        conversationId: convId,
        username: targetUser.username,
        canonicalUsername: targetUser.canonicalUsername,
        avatarId: targetUser.avatarId || null,
        gender: targetUser.gender,
        publicKey: targetUser.publicKey || null,
        isOnline: presenceService.isOnline(targetUser.canonicalUsername),
        lastInteractionAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to create/touch conversation', err);
    res.status(500).json({ error: 'Failed to initialize conversation' });
  }
});

