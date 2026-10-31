import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { messageService } from '../services/message.service.js';
import { logger } from '../utils/logger.js';

export const messageRouter = Router();

/**
 * Get all unexpired messages for the active conversation with a user (last 24 hours).
 */
messageRouter.get('/:username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const currentCanonical = req.user!.canonicalUsername;
  const targetCanonical = (req.params.username || '').toLowerCase().trim();

  if (!targetCanonical) {
    res.status(400).json({ error: 'Target username is required' });
    return;
  }

  try {
    const messages = await messageService.getConversationMessages(currentCanonical, targetCanonical);

    res.json({
      conversationId: messageService.getConversationId(currentCanonical, targetCanonical),
      messages: messages.map((m) => ({
        id: m.id,
        senderCanonical: m.senderCanonical,
        recipientCanonical: m.recipientCanonical,
        ciphertext: m.ciphertext,
        iv: m.iv,
        tag: m.tag,
        senderEphemeralPublicKey: m.senderEphemeralPublicKey,
        createdAt: m.createdAt.toISOString(),
        expiresAt: m.expiresAt.toISOString(),
        status: m.status,
        deliveredAt: m.deliveredAt ? m.deliveredAt.toISOString() : null,
      })),
    });
  } catch (err) {
    logger.error('Failed to retrieve conversation messages', err);
    res.status(500).json({ error: 'Failed to retrieve conversation messages' });
  }
});

/**
 * Acknowledge message delivery
 */
messageRouter.post('/:messageId/ack', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params;
  const currentCanonical = req.user!.canonicalUsername;

  try {
    const updated = await messageService.markMessageDelivered(messageId, currentCanonical);
    if (!updated) {
      res.status(404).json({ error: 'Message not found or already acknowledged' });
      return;
    }

    res.json({ success: true, messageId: updated.id, status: updated.status });
  } catch (err) {
    logger.error('Failed to acknowledge message', err);
    res.status(500).json({ error: 'Failed to acknowledge message' });
  }
});

