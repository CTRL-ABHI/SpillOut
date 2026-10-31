'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { generateSafetyFingerprint, getOrCreateIdentityKeyPair } from '@/lib/crypto';
import { ActiveConversation } from '@/types';
import { DoodleAvatar } from '../doodles/avatars/DoodleAvatar';
import { Search, X, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartConversation: (conversation: ActiveConversation) => void;
  currentUsername: string;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onStartConversation,
  currentUsername,
}) => {
  const [targetUsername, setTargetUsername] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUser, setResolvedUser] = useState<{
    username: string;
    canonicalUsername: string;
    avatarId?: string | null;
    publicKey: string | null;
    isOnline: boolean;
  } | null>(null);

  // Listen for real-time presence updates while viewing the resolved user
  useEffect(() => {
    if (!resolvedUser) return;

    const unsub = socket.on('presence-update', (payload: any) => {
      const target = (payload?.canonicalUsername || '').toLowerCase().trim();
      if (target === resolvedUser.canonicalUsername.toLowerCase().trim()) {
        const isOnline = !!payload?.isOnline;
        setResolvedUser((prev) => (prev ? { ...prev, isOnline } : null));
      }
    });

    const unsubStatus = socket.on('presence-status', (payload: any) => {
      const target = (payload?.username || '').toLowerCase().trim();
      if (target === resolvedUser.canonicalUsername.toLowerCase().trim()) {
        const isOnline = !!payload?.isOnline;
        setResolvedUser((prev) => (prev ? { ...prev, isOnline } : null));
      }
    });

    // Query immediate presence status
    socket.checkPresence(resolvedUser.canonicalUsername);

    return () => {
      unsub();
      unsubStatus();
    };
  }, [resolvedUser]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = targetUsername.trim();
    setError(null);
    setResolvedUser(null);

    if (!clean) {
      setError('Please enter a username');
      return;
    }

    if (clean.toLowerCase() === currentUsername.toLowerCase()) {
      setError('You cannot start a conversation with yourself');
      return;
    }

    setIsSearching(true);

    try {
      const res = await api.getUserPublicKey(clean);
      if (res.error || !res.data) {
        setError(res.error || 'User not found');
        return;
      }

      setResolvedUser(res.data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to lookup user');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async () => {
    if (!resolvedUser) return;

    try {
      let keyFingerprint: string | undefined;
      if (resolvedUser.publicKey) {
        const { publicKeyBase64 } = await getOrCreateIdentityKeyPair();
        keyFingerprint = await generateSafetyFingerprint(publicKeyBase64, resolvedUser.publicKey);
      }

      onStartConversation({
        username: resolvedUser.username,
        canonicalUsername: resolvedUser.canonicalUsername,
        avatarId: resolvedUser.avatarId,
        publicKey: resolvedUser.publicKey,
        isOnline: resolvedUser.isOnline,
        unreadCount: 0,
        keyFingerprint,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not establish encryption key agreement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-neutral-900">
      <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-neutral-300 shadow-modal space-y-5 animate-pop-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-neutral-900" />
            <h3 className="text-base font-extrabold text-neutral-900">Start New Conversation</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          Enter the exact username of the person you wish to contact. Messages are end-to-end encrypted and retained for 24 hours.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            maxLength={10}
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
            placeholder="Username (e.g. Bob02)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 text-sm text-neutral-900 placeholder-neutral-400 font-mono transition"
            autoFocus
          />
          <button
            type="submit"
            disabled={isSearching || !targetUsername.trim()}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm shrink-0"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <span>Find</span>}
          </button>
        </form>

        {error && (
          <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-900 text-xs text-neutral-900 flex items-start gap-2 animate-fade-in font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resolvedUser && (
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-300 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DoodleAvatar
                  avatarId={resolvedUser.avatarId}
                  username={resolvedUser.username}
                  size="md"
                  isOnline={resolvedUser.isOnline}
                  showPresence={true}
                />
                <div>
                  <h4 className="text-sm font-bold font-mono text-neutral-900">
                    @{resolvedUser.username}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {resolvedUser.isOnline ? 'Online • Ready for live call' : 'Offline • 24h message queue active'}
                    </span>
                  </div>
                </div>
              </div>

              {resolvedUser.isOnline ? (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-900 text-white font-bold">
                  Online
                </span>
              ) : (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-bold">
                  24h Queue
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartChat}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <span>Open Encrypted Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
