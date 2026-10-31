import { prisma } from '../db.js';
import { presenceService } from './presence.service.js';
import { logger } from '../utils/logger.js';

export interface UserConversationSummary {
  conversationId: string;
  username: string;
  canonicalUsername: string;
  avatarId: string | null;
  gender: string;
  publicKey: string | null;
  isOnline: boolean;
  lastInteractionAt: string;
  createdAt: string;
}

export class ConversationService {
  /**
   * Deterministically order and normalize two participant usernames.
   */
  public getSortedParticipants(userA: string, userB: string): [string, string] {
    const normA = (userA || '').toLowerCase().trim();
    const normB = (userB || '').toLowerCase().trim();
    return normA <= normB ? [normA, normB] : [normB, normA];
  }

  /**
   * Deterministic conversation ID for two users (e.g. "alice:bob")
   */
  public getConversationId(userA: string, userB: string): string {
    const [p1, p2] = this.getSortedParticipants(userA, userB);
    return `${p1}:${p2}`;
  }

  /**
   * Create or update a conversation relationship between two users.
   * Updates lastInteractionAt timestamp.
   * Completely separated from 24-hour message content lifecycle.
   */
  public async touchConversation(userA: string, userB: string): Promise<void> {
    const [p1, p2] = this.getSortedParticipants(userA, userB);
    if (!p1 || !p2 || p1 === p2) return;

    const id = `${p1}:${p2}`;
    const now = new Date();

    try {
      await prisma.conversation.upsert({
        where: {
          participant1Canonical_participant2Canonical: {
            participant1Canonical: p1,
            participant2Canonical: p2,
          },
        },
        create: {
          id,
          participant1Canonical: p1,
          participant2Canonical: p2,
          createdAt: now,
          lastInteractionAt: now,
        },
        update: {
          lastInteractionAt: now,
        },
      });
    } catch (err) {
      logger.warn(`Could not upsert conversation metadata for ${id}`, err);
    }
  }

  /**
   * Retrieve all active conversation relationships for an authenticated user.
   * Returns participant metadata, avatars, and live presence.
   * Persists even after all 24-hour encrypted message rows have expired.
   */
  public async listUserConversations(userCanonical: string): Promise<UserConversationSummary[]> {
    const canonical = (userCanonical || '').toLowerCase().trim();
    if (!canonical) return [];

    try {
      const records = await prisma.conversation.findMany({
        where: {
          OR: [
            { participant1Canonical: canonical },
            { participant2Canonical: canonical },
          ],
        },
        orderBy: {
          lastInteractionAt: 'desc',
        },
      });

      if (records.length === 0) return [];

      // Collect all peer canonical usernames
      const peerCanonicals = records.map((r) =>
        r.participant1Canonical === canonical ? r.participant2Canonical : r.participant1Canonical
      );

      // Fetch user profile metadata for all peers
      const peerUsers = await prisma.user.findMany({
        where: {
          canonicalUsername: {
            in: peerCanonicals,
          },
        },
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

      const userMap = new Map<string, (typeof peerUsers)[0]>();
      for (const u of peerUsers) {
        userMap.set(u.canonicalUsername, u);
      }

      const summaries: UserConversationSummary[] = [];

      for (const rec of records) {
        const peerCanonical = rec.participant1Canonical === canonical ? rec.participant2Canonical : rec.participant1Canonical;
        const peer = userMap.get(peerCanonical);

        // If peer user no longer exists (e.g. deleted due to inactivity), skip
        if (!peer) continue;

        const isOnline = presenceService.isOnline(peer.canonicalUsername);

        summaries.push({
          conversationId: rec.id,
          username: peer.username,
          canonicalUsername: peer.canonicalUsername,
          avatarId: peer.avatarId || null,
          gender: peer.gender,
          publicKey: peer.publicKey || null,
          isOnline,
          lastInteractionAt: rec.lastInteractionAt.toISOString(),
          createdAt: rec.createdAt.toISOString(),
        });
      }

      return summaries;
    } catch (err) {
      logger.error('Failed to list user conversations', err);
      return [];
    }
  }

  /**
   * Delete all conversations where a user is a participant.
   * Called during account deletion or 7-day inactivity purge.
   */
  public async deleteUserConversations(userCanonical: string): Promise<number> {
    const canonical = (userCanonical || '').toLowerCase().trim();
    if (!canonical) return 0;

    try {
      const result = await prisma.conversation.deleteMany({
        where: {
          OR: [
            { participant1Canonical: canonical },
            { participant2Canonical: canonical },
          ],
        },
      });
      return result.count;
    } catch (err) {
      logger.error(`Failed to delete conversations for ${canonical}`, err);
      return 0;
    }
  }
}

export const conversationService = new ConversationService();

