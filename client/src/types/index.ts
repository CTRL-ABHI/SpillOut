export type Gender = 'Male' | 'Female' | 'Object';
export type DisplayGender = 'Banana' | 'Peach' | 'Tomato';

export const GENDER_MAP: Record<Gender, DisplayGender> = {
  Male: 'Banana',
  Female: 'Peach',
  Object: 'Tomato',
};

export const DISPLAY_TO_GENDER: Record<DisplayGender, Gender> = {
  Banana: 'Male',
  Peach: 'Female',
  Tomato: 'Object',
};

export interface User {
  id: string;
  username: string;
  canonicalUsername: string;
  gender: Gender;
  avatarId?: string | null;
  publicKey?: string | null;
  createdAt: string;
  lastActivityAt: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  timestamp: string;
  expiresAt?: string;
  isSelf: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  isDecrypted: boolean;
}

export interface ActiveConversation {
  username: string;
  canonicalUsername: string;
  gender?: Gender;
  avatarId?: string | null;
  publicKey?: string | null;
  isOnline: boolean;
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageTime?: string;
  keyFingerprint?: string;
}

export type CallState =
  | 'idle'
  | 'initiating'
  | 'ringing-outgoing'
  | 'ringing-incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export interface CallSession {
  callId: string;
  peerUsername: string;
  isIncoming: boolean;
  state: CallState;
  startTime?: number;
  isMuted: boolean;
  errorMessage?: string;
}
