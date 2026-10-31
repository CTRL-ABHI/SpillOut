import crypto from 'crypto';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

export interface CreateMessageInput {
  id?: string;
  senderCanonical: string;
  recipientCanonical: string;
  ciphertext: string;
  iv: string;
  tag?: string;
  senderEphemeralPublicKey: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderCanonical: string;
  recipientCanonical: string;
  ciphertext: string;
  iv: string;
  tag: string | null;
  senderEphemeralPublicKey: string;
  createdAt: Date;
  expiresAt: Date;
  status: string;
  deliveredAt: Date | null;
}

export class MessageService {
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Deterministic conversation ID for two users (e.g. "alice:bob")
   */
  public getConversationId(userA: string, userB: string): string {
    const normA = (userA || '').toLowerCase().trim();
    const normB = (userB || '').toLowerCase().trim();
    return [normA, normB].sort().join(':');
  }

  /**
   * Store an encrypted message payload with a 24-hour expiration window.
   * Idempotent: If message with same ID already exists, returns existing record.
   */
  public async createMessage(input: CreateMessageInput): Promise<StoredMessage> {
    const id = input.id || `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const conversationId = this.getConversationId(input.senderCanonical, input.recipientCanonical);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours UTC

    try {
      // Check for existing message with same ID to ensure idempotency
      const existing = await prisma.message.findUnique({
        where: { id },
      });

      if (existing) {
        return existing;
      }

      const message = await prisma.message.create({
        data: {
          id,
          conversationId,
          senderCanonical: input.senderCanonical.toLowerCase().trim(),
          recipientCanonical: input.recipientCanonical.toLowerCase().trim(),
          ciphertext: input.ciphertext,
          iv: input.iv,
          tag: input.tag || null,
          senderEphemeralPublicKey: input.senderEphemeralPublicKey,
          createdAt: now,
          expiresAt,
          status: 'sent',
          deliveredAt: null,
        },
      });

      return message;
    } catch (err: any) {
      // Handle unique constraint race condition gracefully
      if (err?.code === 'P2002') {
        const existing = await prisma.message.findUnique({ where: { id } });
        if (existing) return existing;
      }
      logger.error('Failed to store encrypted message', err);
      throw err;
    }
  }

  /**
   * Retrieve unexpired pending messages for a recipient that haven't been delivered yet.
   */
  public async getPendingMessagesForRecipient(recipientCanonical: string): Promise<StoredMessage[]> {
    const canonical = recipientCanonical.toLowerCase().trim();
    const now = new Date();

    return prisma.message.findMany({
      where: {
        recipientCanonical: canonical,
        expiresAt: { gt: now },
        status: 'sent',
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Retrieve all unexpired messages for a specific conversation within the 24-hour window.
   */
  public async getConversationMessages(userA: string, userB: string): Promise<StoredMessage[]> {
    const conversationId = this.getConversationId(userA, userB);
    const now = new Date();

    return prisma.message.findMany({
      where: {
        conversationId,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Mark a message as delivered upon recipient client acknowledgement.
   */
  public async markMessageDelivered(messageId: string, recipientCanonical: string): Promise<StoredMessage | null> {
    const canonical = recipientCanonical.toLowerCase().trim();
    try {
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!msg || msg.recipientCanonical !== canonical) {
        return null;
      }

      if (msg.status === 'delivered') {
        return msg;
      }

      return await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn(`Could not mark message ${messageId} as delivered`, err);
      return null;
    }
  }

  /**
   * Permanently delete expired messages from the database.
   */
  public async cleanupExpiredMessages(): Promise<number> {
    const now = new Date();
    try {
      const result = await prisma.message.deleteMany({
        where: {
          expiresAt: {
            lte: now,
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Message retention cleanup: deleted ${result.count} expired messages older than 24 hours`);
      }
      return result.count;
    } catch (err) {
      logger.error('Error during scheduled message expiration cleanup', err);
      return 0;
    }
  }

  /**
   * Start scheduled background execution for 24-hour message cleanup.
   */
  public startCleanup(intervalMs: number = 10 * 60 * 1000): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Run cleanup immediately on boot
    this.cleanupExpiredMessages().catch((err) => {
      logger.error('Initial message cleanup failed', err);
    });

    // Run periodically every intervalMs (default 10 minutes)
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages().catch((err) => {
        logger.error('Scheduled message cleanup failed', err);
      });
    }, intervalMs);

    logger.info(`Message retention cleanup service started (interval: ${intervalMs / 1000}s)`);
  }

  /**
   * Stop scheduled execution.
   */
  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const messageService = new MessageService();

