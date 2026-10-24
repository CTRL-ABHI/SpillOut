export type Gender = 'Male' | 'Female' | 'Object';

export interface User {
  id: string;
  username: string;
  canonicalUsername: string;
  gender: Gender;
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
  isSelf: boolean;
  status: 'sending' | 'delivered' | 'failed';
  isDecrypted: boolean;
}

export interface ActiveConversation {
  username: string;
  canonicalUsername: string;
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
