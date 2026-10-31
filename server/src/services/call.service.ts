import { logger } from '../utils/logger.js';
import { presenceService } from './presence.service.js';

export interface CallSession {
  callId: string;
  callerCanonical: string;
  callerUsername: string;
  recipientCanonical: string;
  recipientUsername: string;
  status: 'ringing' | 'connected' | 'ended';
  createdAt: Date;
  lastActivityAt: Date;
  ringingTimeoutTimer: NodeJS.Timeout | null;
}

export class CallService {
  // callId -> CallSession
  private activeCalls = new Map<string, CallSession>();
  // canonicalUsername -> callId (fast index for user's active call)
  private userToCallId = new Map<string, string>();

  private normalize(username: string): string {
    return (username || '').toLowerCase().trim();
  }

  /**
   * Check if a user is currently participating in an active or ringing call.
   */
  public isUserBusy(username: string): boolean {
    const canonical = this.normalize(username);
    const callId = this.userToCallId.get(canonical);
    if (!callId) return false;

    const session = this.activeCalls.get(callId);
    if (!session || session.status === 'ended') {
      this.userToCallId.delete(canonical);
      return false;
    }

    return session.status === 'ringing' || session.status === 'connected';
  }

  /**
   * Get active call session by callId
   */
  public getCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Atomically reserve a new call session between caller and recipient.
   */
  public reserveCall(
    callId: string,
    callerCanonical: string,
    callerUsername: string,
    recipientCanonical: string,
    recipientUsername: string,
    onTimeout: (session: CallSession) => void
  ): { success: boolean; reason?: string; session?: CallSession } {
    const caller = this.normalize(callerCanonical);
    const recipient = this.normalize(recipientCanonical);

    if (caller === recipient) {
      return { success: false, reason: 'Cannot call yourself' };
    }

    // Check if recipient is busy
    if (this.isUserBusy(recipient)) {
      return { success: false, reason: 'User is on another call' };
    }

    // If caller has a stale lingering call, clean it up first
    if (this.isUserBusy(caller)) {
      const oldCallId = this.userToCallId.get(caller);
      if (oldCallId) {
        this.releaseCall(oldCallId, 'Caller initiated a new call');
      }
    }

    // Setup 45-second auto-release ringing timer
    const timeoutTimer = setTimeout(() => {
      const current = this.activeCalls.get(callId);
      if (current && current.status === 'ringing') {
        this.releaseCall(callId, 'No answer from recipient (call timed out)');
        onTimeout(current);
      }
    }, 45000);

    const session: CallSession = {
      callId,
      callerCanonical: caller,
      callerUsername,
      recipientCanonical: recipient,
      recipientUsername,
      status: 'ringing',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      ringingTimeoutTimer: timeoutTimer,
    };

    this.activeCalls.set(callId, session);
    this.userToCallId.set(caller, callId);
    this.userToCallId.set(recipient, callId);

    logger.info(`Call session reserved: ${callId} (${caller} -> ${recipient})`);
    return { success: true, session };
  }

  /**
   * Transition call session to 'connected' once accepted.
   */
  public acceptCall(callId: string, recipientCanonical: string): CallSession | null {
    const session = this.activeCalls.get(callId);
    if (!session) return null;

    const recipient = this.normalize(recipientCanonical);
    if (session.recipientCanonical !== recipient) return null;

    if (session.ringingTimeoutTimer) {
      clearTimeout(session.ringingTimeoutTimer);
      session.ringingTimeoutTimer = null;
    }

    session.status = 'connected';
    session.lastActivityAt = new Date();

    logger.info(`Call session connected: ${callId} (${session.callerCanonical} <-> ${session.recipientCanonical})`);
    return session;
  }

  /**
   * Release and terminate a call session, freeing both participants immediately.
   */
  public releaseCall(callId: string, reason?: string): CallSession | null {
    const session = this.activeCalls.get(callId);
    if (!session) return null;

    if (session.ringingTimeoutTimer) {
      clearTimeout(session.ringingTimeoutTimer);
      session.ringingTimeoutTimer = null;
    }

    session.status = 'ended';
    session.lastActivityAt = new Date();

    this.activeCalls.delete(callId);
    this.userToCallId.delete(session.callerCanonical);
    this.userToCallId.delete(session.recipientCanonical);

    logger.info(`Call session released: ${callId} (${reason || 'Ended'})`);
    return session;
  }

  /**
   * Terminate any active call involving a user who just disconnected.
   */
  public handleUserDisconnected(username: string): { peerCanonical?: string; callId?: string } | null {
    const canonical = this.normalize(username);
    const callId = this.userToCallId.get(canonical);
    if (!callId) return null;

    const session = this.activeCalls.get(callId);
    if (!session) {
      this.userToCallId.delete(canonical);
      return null;
    }

    const peerCanonical = session.callerCanonical === canonical ? session.recipientCanonical : session.callerCanonical;
    this.releaseCall(callId, `Participant disconnected (${canonical})`);

    return { peerCanonical, callId };
  }
}

export const callService = new CallService();

