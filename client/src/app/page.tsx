'use client';

import React, { useState, useEffect } from 'react';
import { User, ActiveConversation, ChatMessage, CallState } from '@/types';
import { api, getApiSessionToken } from '@/lib/api';
import { socket } from '@/lib/socket';
import {
  getOrCreateIdentityKeyPair,
  encryptTextMessage,
  tryDecryptTextMessage,
  purgeCryptographicMemory,
} from '@/lib/crypto';
import { webrtcVoice } from '@/lib/webrtc';
import { sound } from '@/lib/sound';

import { Logo } from '@/components/branding/Logo';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { UserSearchModal } from '@/components/chat/UserSearchModal';
import { VoiceCallModal } from '@/components/voice/VoiceCallModal';
import { BlurOverlay } from '@/components/privacy/BlurOverlay';
import { DoodleWallpaper } from '@/components/doodles/DoodleWallpaper';
import { EmptyChatDoodle } from '@/components/doodles/EmptyChatDoodle';

import {
  Shield,
  Lock,
  Phone,
  Clock,
  Sparkles,
  Loader2,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

export default function SpilloutApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  // Active Conversations and unexpired messages (24-hour retention)
  const [conversations, setConversations] = useState<ActiveConversation[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<string | null>(null);
  // mapping of canonicalUsername -> ChatMessage[]
  const [messagesByRecipient, setMessagesByRecipient] = useState<Record<string, ChatMessage[]>>({});

  // Modals & Voice Call
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hoursUntilExpiration, setHoursUntilExpiration] = useState(168);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Call state
  const [callSession, setCallSession] = useState<{
    peerUsername: string;
    peerAvatarId?: string | null;
    callState: CallState;
    isIncoming: boolean;
    callId?: string;
    errorMessage?: string;
  }>({
    peerUsername: '',
    callState: 'idle',
    isIncoming: false,
  });

  // 1. Initial Session Check
  useEffect(() => {
    async function initSession() {
      try {
        const res = await api.getMe();
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          await getOrCreateIdentityKeyPair(res.data.user.canonicalUsername);
          const token = res.data.token || getApiSessionToken();
          socket.connect(token || undefined);
          loadAccountStatus();
        }
      } catch (err) {
        console.error('Session initialization error', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, []);

  const loadAccountStatus = async () => {
    try {
      const res = await api.getAccountStatus();
      if (res.data?.account?.hoursUntilInactivityDeletion !== undefined) {
        setHoursUntilExpiration(res.data.account.hoursUntilInactivityDeletion);
      }
    } catch {}
  };

  // 2. Setup WebSocket Listeners and WebRTC Voice Calling
  useEffect(() => {
    if (!currentUser) return;

    // A. Listen for incoming E2EE messages
    const unsubMsg = socket.on('e2ee-message', async (payload: any) => {
      try {
        const { id, senderUsername, senderCanonical, ciphertext, iv, senderEphemeralPublicKey, timestamp } = payload;

        // Decrypt using Web Crypto API
        const { text: plaintext, isDecrypted } = await tryDecryptTextMessage(
          ciphertext,
          iv,
          senderEphemeralPublicKey
        );

        sound.playMessageChime();

        // Acknowledge receipt to server immediately
        const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        if (id) {
          socket.acknowledgeMessage(id);
        }

        const newMsg: ChatMessage = {
          id: msgId,
          sender: senderUsername,
          recipient: currentUser.username,
          text: plaintext,
          timestamp: timestamp || new Date().toISOString(),
          isSelf: false,
          status: 'delivered',
          isDecrypted,
        };

        setMessagesByRecipient((prev) => {
          const list = prev[senderCanonical] || [];
          if (list.some((m) => m.id === msgId)) {
            return prev;
          }
          return {
            ...prev,
            [senderCanonical]: [...list, newMsg],
          };
        });

        // Update or insert conversation in active memory
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.canonicalUsername === senderCanonical);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              lastMessageSnippet: plaintext.slice(0, 30),
              lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              unreadCount: activeRecipient === senderCanonical ? 0 : updated[index].unreadCount + 1,
            };
            return updated;
          } else {
            return [
              {
                username: senderUsername,
                canonicalUsername: senderCanonical,
                publicKey: senderEphemeralPublicKey,
                isOnline: true,
                unreadCount: activeRecipient === senderCanonical ? 0 : 1,
                lastMessageSnippet: plaintext.slice(0, 30),
                lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
              ...prev,
            ];
          }
        });
      } catch (decErr) {
        console.error('Failed to process incoming message', decErr);
      }
    });

    // B. Listen for server acceptance acknowledgement (status: sent)
    const unsubSent = socket.on('message-sent', (payload: any) => {
      const { messageId, recipientCanonical } = payload;
      setMessagesByRecipient((prev) => {
        const list = prev[recipientCanonical] || [];
        return {
          ...prev,
          [recipientCanonical]: list.map((m) =>
            m.id === messageId ? { ...m, status: m.status === 'delivered' ? 'delivered' : 'sent' } : m
          ),
        };
      });
    });

    // C. Listen for recipient acknowledgement (status: delivered)
    const unsubDelivered = socket.on('message-delivered', (payload: any) => {
      const { messageId, recipientCanonical } = payload;
      setMessagesByRecipient((prev) => {
        const list = prev[recipientCanonical] || [];
        return {
          ...prev,
          [recipientCanonical]: list.map((m) =>
            m.id === messageId ? { ...m, status: 'delivered' } : m
          ),
        };
      });
    });

    // D. Listen for initial presence snapshot upon connection / reconnection
    const unsubSnapshot = socket.on('presence-snapshot', (payload: any) => {
      const onlineUsers: string[] = (payload?.onlineUsers || []).map((u: string) => u.toLowerCase().trim());
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          isOnline: onlineUsers.includes(c.canonicalUsername.toLowerCase().trim()),
        }))
      );
    });

    // E. Listen for real-time presence updates (user came online / went offline)
    const unsubPresence = socket.on('presence-update', (payload: any) => {
      const target = (payload?.canonicalUsername || '').toLowerCase().trim();
      const isOnline = !!payload?.isOnline;
      setConversations((prev) =>
        prev.map((c) =>
          c.canonicalUsername.toLowerCase().trim() === target ? { ...c, isOnline } : c
        )
      );
    });

    // F. Listen for individual presence status responses
    const unsubStatus = socket.on('presence-status', (payload: any) => {
      const target = (payload?.username || '').toLowerCase().trim();
      const isOnline = !!payload?.isOnline;
      setConversations((prev) =>
        prev.map((c) =>
          c.canonicalUsername.toLowerCase().trim() === target ? { ...c, isOnline } : c
        )
      );
    });

    // G. Listen for socket reconnection and re-verify presence
    const unsubStatusChange = socket.on('connection-status', ({ status }: any) => {
      if (status === 'connected') {
        setConversations((prev) => {
          prev.forEach((c) => {
            socket.checkPresence(c.username);
          });
          return prev;
        });
      }
    });

    // H. Listen for message failure notices
    const unsubFailed = socket.on('message-failed', (payload: any) => {
      const messageId = payload?.messageId;
      if (messageId) {
        setMessagesByRecipient((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map((m) =>
              m.id === messageId ? { ...m, status: 'failed' } : m
            );
          }
          return updated;
        });
      }
      setToastMessage(payload?.reason || 'Message failed to deliver');
      setTimeout(() => setToastMessage(null), 5000);
    });

    // I. Initialize WebRTC voice manager
    const cleanupVoice = webrtcVoice.init({
      onStateChange: (state, error) => {
        setCallSession((prev) => ({
          ...prev,
          callState: state,
          errorMessage: error,
        }));
      },
      onRemoteStream: () => {},
      onIncomingCall: (fromUsername, callId) => {
        const conv = conversations.find(
          (c) => c.canonicalUsername.toLowerCase().trim() === fromUsername.toLowerCase().trim()
        );
        setCallSession({
          peerUsername: fromUsername,
          peerAvatarId: conv?.avatarId,
          callState: 'ringing-incoming',
          isIncoming: true,
          callId,
        });
      },
    });

    return () => {
      unsubMsg();
      unsubSent();
      unsubDelivered();
      unsubSnapshot();
      unsubPresence();
      unsubStatus();
      unsubStatusChange();
      unsubFailed();
      cleanupVoice();
    };
  }, [currentUser, activeRecipient, conversations]);

  // Handle successful login or registration
  const handleAuthSuccess = async (user: User, token: string) => {
    setCurrentUser(user);
    await getOrCreateIdentityKeyPair(user.canonicalUsername);
    socket.connect(token);
    loadAccountStatus();
  };

  // Handle Logout (24h messages remain securely decryptable on this device)
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    // Purge runtime memory
    purgeCryptographicMemory();
    socket.disconnect();
    webrtcVoice.cleanup();
    setCurrentUser(null);
    setConversations([]);
    setMessagesByRecipient({});
    setActiveRecipient(null);
  };

  // Update profile avatar
  const handleUpdateAvatar = async (avatarId: string | null) => {
    try {
      const res = await api.updateAvatar(avatarId);
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to update avatar', err);
    }
  };

  // Select conversation and load unexpired messages from the last 24 hours
  const handleSelectConversation = async (canonicalUsername: string) => {
    setActiveRecipient(canonicalUsername);
    const conv = conversations.find((c) => c.canonicalUsername === canonicalUsername);
    if (!conv) return;

    // Reset unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.canonicalUsername === canonicalUsername ? { ...c, unreadCount: 0 } : c))
    );

    // Resolve public key if missing
    let peerPublicKey = conv.publicKey;
    if (!peerPublicKey) {
      try {
        const keyRes = await api.getUserPublicKey(conv.username);
        if (keyRes.data?.user) {
          peerPublicKey = keyRes.data.user.publicKey;
          conv.publicKey = peerPublicKey;
          if (keyRes.data.user.avatarId) {
            conv.avatarId = keyRes.data.user.avatarId;
          }
        }
      } catch {}
    }

    // Retrieve unexpired 24-hour messages from backend
    try {
      const historyRes = await api.getConversationMessages(conv.username);
      if (historyRes.data?.messages) {
        const decryptedList: ChatMessage[] = [];

        for (const m of historyRes.data.messages) {
          const isSelf = m.senderCanonical === currentUser?.canonicalUsername.toLowerCase().trim();
          const decryptionKey = isSelf ? peerPublicKey : m.senderEphemeralPublicKey;

          let text = '[Encrypted message]';
          let isDecrypted = false;

          if (decryptionKey) {
            const dec = await tryDecryptTextMessage(m.ciphertext, m.iv, decryptionKey);
            text = dec.text;
            isDecrypted = dec.isDecrypted;
          }

          decryptedList.push({
            id: m.id,
            sender: isSelf ? currentUser!.username : conv.username,
            recipient: isSelf ? conv.username : currentUser!.username,
            text,
            timestamp: m.createdAt,
            expiresAt: m.expiresAt,
            isSelf,
            status: m.status as any,
            isDecrypted,
          });

          // Acknowledge incoming pending messages that haven't been delivered yet
          if (!isSelf && m.status === 'sent') {
            socket.acknowledgeMessage(m.id);
          }
        }

        setMessagesByRecipient((prev) => ({
          ...prev,
          [canonicalUsername]: decryptedList,
        }));
      }
    } catch (err) {
      console.warn('Could not fetch conversation history', err);
    }
  };

  // Send an encrypted message to the active recipient
  const handleSendMessage = async (text: string) => {
    if (!currentUser || !activeRecipient) return;
    const conversation = conversations.find((c) => c.canonicalUsername === activeRecipient);
    if (!conversation) return;

    // Resolve public key if missing
    let peerPublicKey = conversation.publicKey;
    if (!peerPublicKey) {
      const keyRes = await api.getUserPublicKey(conversation.username);
      if (keyRes.data?.user.publicKey) {
        peerPublicKey = keyRes.data.user.publicKey;
        conversation.publicKey = peerPublicKey;
        if (keyRes.data.user.avatarId) {
          conversation.avatarId = keyRes.data.user.avatarId;
        }
      } else {
        throw new Error('Recipient has not published a valid encryption key');
      }
    }

    // Encrypt using Web Crypto API on device
    const encrypted = await encryptTextMessage(text, peerPublicKey);
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newMsg: ChatMessage = {
      id: messageId,
      sender: currentUser.username,
      recipient: conversation.username,
      text,
      timestamp: new Date().toISOString(),
      isSelf: true,
      status: 'sending',
      isDecrypted: true,
    };

    setMessagesByRecipient((prev) => ({
      ...prev,
      [activeRecipient]: [...(prev[activeRecipient] || []), newMsg],
    }));

    // Relay ciphertext to recipient through server with 24-hour expiration queue
    const sent = socket.sendE2EEMessage(
      conversation.username,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.senderEphemeralPublicKey,
      messageId
    );

    if (!sent) {
      setMessagesByRecipient((prev) => ({
        ...prev,
        [activeRecipient]: (prev[activeRecipient] || []).map((m) =>
          m.id === messageId ? { ...m, status: 'failed' } : m
        ),
      }));
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.canonicalUsername === activeRecipient
          ? {
              ...c,
              lastMessageSnippet: text.slice(0, 30),
              lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : c
      )
    );
  };

  // Start voice call
  const handleStartVoiceCall = async (recipientUsername: string) => {
    const conv = conversations.find(
      (c) => c.username.toLowerCase().trim() === recipientUsername.toLowerCase().trim()
    );
    setCallSession({
      peerUsername: recipientUsername,
      peerAvatarId: conv?.avatarId,
      callState: 'initiating',
      isIncoming: false,
    });
    await webrtcVoice.startCall(recipientUsername);
  };

  const activeConversation = conversations.find((c) => c.canonicalUsername === activeRecipient);
  const activeMessages = activeRecipient ? messagesByRecipient[activeRecipient] || [] : [];

  // 1. Initializing State
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden text-neutral-900">
        <DoodleWallpaper opacity={0.035} />
        <div className="relative z-10 flex flex-col items-center">
          <Logo size="lg" showSubtitle={true} />
          <div className="mt-8 flex items-center gap-2.5 text-xs font-mono text-neutral-500 bg-neutral-100 border border-neutral-300 px-3.5 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-900" />
            <span>Initializing secure runtime environment...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authentication View (Not Logged In)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background text-neutral-900 flex flex-col justify-between p-4 sm:p-8 relative overflow-x-hidden selection:bg-neutral-900 selection:text-white">
        <DoodleWallpaper opacity={0.035} />

        {/* Top Navbar */}
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10 py-2">
          <Logo size="md" showSubtitle={false} />
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-xs font-mono font-bold text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300"
            >
              <Shield className="w-3.5 h-3.5 text-neutral-900" />
              <span>Threat Model</span>
            </Link>
          </div>
        </header>

        {/* Center Main Stage */}
        <main className="max-w-6xl w-full mx-auto py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center z-10">
          {/* Brand Highlights & Intro */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-300 text-xs font-mono font-bold text-neutral-800">
              <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
              <span>Encrypted 24-Hour Communication</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08]">
              Private talks.
              <br />
              <span className="underline decoration-wavy decoration-neutral-300 underline-offset-8">
                24-Hour retention.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-lg">
              SpillOut gives you direct, encrypted conversations with 24-hour message retention. Messages expire permanently after 24 hours, keeping your chats private without building permanent archives.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-white border border-neutral-300 shadow-sm space-y-1">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <Lock className="w-4 h-4 text-neutral-900" />
                  <span>Real E2EE Text</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Encrypted on device. Server stores only opaque ciphertext for 24h.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-neutral-300 shadow-sm space-y-1">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <Phone className="w-4 h-4 text-neutral-900" />
                  <span>Encrypted Voice</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  WebRTC DTLS-SRTP peer-to-peer. Zero audio recordings or logs.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-neutral-300 shadow-sm space-y-1">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <Clock className="w-4 h-4 text-neutral-900" />
                  <span>24-Hour Expiration</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Messages are permanently deleted after 24 hours. Inactive accounts purge in 7 days.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-neutral-300 shadow-sm space-y-1">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <Shield className="w-4 h-4 text-neutral-900" />
                  <span>3×3 Password Grid</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Unconventional matrix authentication. No email or phone required.
                </p>
              </div>
            </div>
          </div>

          {/* Auth Forms Column */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            {authMode === 'signup' ? (
              <SignUpForm
                onSuccess={handleAuthSuccess}
                onSwitchToLogin={() => setAuthMode('login')}
              />
            ) : (
              <LoginForm
                onSuccess={handleAuthSuccess}
                onSwitchToSignUp={() => setAuthMode('signup')}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-mono gap-2 z-10">
          <div>SpillOut • Ephemeral Encrypted Communication</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-neutral-900 transition">
              Threat Model
            </Link>
            <span>•</span>
            <span>No Ads</span>
            <span>•</span>
            <span>No Trackers</span>
          </div>
        </footer>
      </div>
    );
  }

  // 3. Authenticated Dashboard & Communication Workspace
  return (
    <div className="h-screen w-screen bg-white flex flex-col overflow-hidden relative text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <BlurOverlay enabled={true} />

      {/* Floating Toast Notice */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700 text-xs text-white shadow-modal flex items-center gap-2 animate-fade-in font-medium">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Active Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Conversation List */}
        <div className={`h-full ${activeRecipient ? 'hidden sm:flex' : 'flex w-full sm:w-auto'}`}>
          <ConversationList
            user={currentUser}
            conversations={conversations}
            activeRecipient={activeRecipient}
            onSelectConversation={handleSelectConversation}
            onOpenNewChat={() => setIsSearchOpen(true)}
            onLogout={handleLogout}
            onUpdateAvatar={handleUpdateAvatar}
            hoursUntilExpiration={hoursUntilExpiration}
          />
        </div>

        {/* Main Chat View or Empty State */}
        {activeConversation ? (
          <div className={`flex-1 h-full ${!activeRecipient ? 'hidden sm:flex' : 'flex'}`}>
            <ChatView
              conversation={activeConversation}
              messages={activeMessages}
              onSendMessage={handleSendMessage}
              onStartVoiceCall={handleStartVoiceCall}
              onBack={() => setActiveRecipient(null)}
            />
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 flex-col items-center justify-center p-8 text-center bg-neutral-50/50 space-y-5 relative overflow-hidden">
            <DoodleWallpaper opacity={0.035} />

            <div className="relative z-10 flex flex-col items-center">
              <EmptyChatDoodle />

              <div className="mt-4">
                <h3 className="text-xl font-extrabold text-neutral-900">
                  Encrypted Workspace Ready
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mt-1.5 leading-relaxed">
                  Start a private conversation by entering another person&apos;s username. Messages are encrypted on device and retained for 24 hours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="mt-4 py-2.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Conversation</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Search & Start Chat Modal */}
      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentUsername={currentUser.username}
        onStartConversation={(newConv) => {
          setConversations((prev) => {
            const exists = prev.find((c) => c.canonicalUsername === newConv.canonicalUsername);
            return exists ? prev : [newConv, ...prev];
          });
          handleSelectConversation(newConv.canonicalUsername);
        }}
      />

      {/* WebRTC Voice Call Modal */}
      <VoiceCallModal
        peerUsername={callSession.peerUsername}
        peerAvatarId={callSession.peerAvatarId}
        callState={callSession.callState}
        isIncoming={callSession.isIncoming}
        errorMessage={callSession.errorMessage}
        onAccept={async () => {
          if (callSession.callId) {
            await webrtcVoice.acceptCall(callSession.peerUsername, callSession.callId);
          }
        }}
        onDecline={() => {
          if (callSession.callId) {
            webrtcVoice.declineCall(callSession.peerUsername, callSession.callId);
          }
        }}
        onEndCall={() => {
          webrtcVoice.endCall();
        }}
      />
    </div>
  );
}
