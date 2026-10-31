import { prisma } from '../db.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { presenceService } from './presence.service.js';
import { conversationService } from './conversation.service.js';

/**
 * 7-Day Inactivity Deletion Service
 *
 * Permanently removes accounts and sessions for users who have been
 * inactive for 7 or more consecutive days.
 *
 * Architectural guarantees:
 * - Idempotent and safe to run concurrently
 * - Removes User record (cascading deletes sessions)
 * - Evicts active temporary presence records and closes WebSockets
 * - Frees username for re-registration
 */

export class AccountCleanupService {
  private timer: NodeJS.Timeout | null = null;

  /**
   * Calculate the expiration cutoff timestamp (now - 7 days)
   */
  public getCutoffDate(days: number = config.inactivityExpirationDays): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }

  /**
   * Run the cleanup job once.
   * Returns the count of deleted accounts.
   */
  public async cleanupExpiredAccounts(): Promise<number> {
    const cutoff = this.getCutoffDate();
    logger.info(`Running account inactivity cleanup for accounts inactive before: ${cutoff.toISOString()}`);

    try {
      // Find all accounts inactive for 7 or more days
      const expiredUsers = await prisma.user.findMany({
        where: {
          lastActivityAt: {
            lt: cutoff,
          },
        },
        select: {
          id: true,
          canonicalUsername: true,
        },
      });

      if (expiredUsers.length === 0) {
        logger.info('Inactivity cleanup: No expired accounts found');
        return 0;
      }

      logger.info(`Found ${expiredUsers.length} expired accounts to delete`);

      let deletedCount = 0;
      for (const user of expiredUsers) {
        try {
          // Terminate active presence and connections immediately
          presenceService.disconnectUser(user.canonicalUsername, 'Account permanently expired after 7 days of inactivity');

          // Clean up user conversation relationships
          await conversationService.deleteUserConversations(user.canonicalUsername).catch(() => {});

          // Delete user (Prisma cascade deletes associated Session records)
          await prisma.user.delete({
            where: { id: user.id },
          });

          deletedCount++;
        } catch (delErr) {
          // Idempotency: if already deleted by a concurrent thread, continue cleanly
          logger.warn(`Could not delete user id ${user.id} (may have been deleted concurrently)`, delErr);
        }
      }

      logger.info(`Successfully deleted ${deletedCount} expired accounts and associated session records`);
      return deletedCount;
    } catch (err) {
      logger.error('Error during scheduled inactivity cleanup job', err);
      return 0;
    }
  }

  /**
   * Start scheduled background execution
   */
  public start(intervalMs: number = config.inactivityCheckIntervalMs): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Run initial cleanup on startup
    this.cleanupExpiredAccounts().catch((err) => {
      logger.error('Initial cleanup job failed', err);
    });

    // Schedule periodic recurring job
    this.timer = setInterval(() => {
      this.cleanupExpiredAccounts().catch((err) => {
        logger.error('Scheduled cleanup job failed', err);
      });
    }, intervalMs);

    logger.info(`Account cleanup service started. Running every ${intervalMs / 1000}s`);
  }

  /**
   * Stop scheduled execution
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Account cleanup service stopped');
    }
  }
}

export const accountCleanupService = new AccountCleanupService();
