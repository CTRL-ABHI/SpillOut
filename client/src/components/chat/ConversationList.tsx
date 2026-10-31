'use client';

import React, { useState } from 'react';
import { ActiveConversation, User, GENDER_MAP } from '@/types';
import { Logo } from '../branding/Logo';
import { DoodleAvatar } from '../doodles/avatars/DoodleAvatar';
import { AvatarPickerModal } from '../doodles/avatars/AvatarPickerModal';
import { Plus, Shield, LogOut, Clock, MessageSquare, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ConversationListProps {
  user: User;
  conversations: ActiveConversation[];
  activeRecipient: string | null;
  onSelectConversation: (canonicalUsername: string) => void;
  onOpenNewChat: () => void;
  onLogout: () => void;
  onUpdateAvatar?: (avatarId: string | null) => Promise<void>;
  hoursUntilExpiration?: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  user,
  conversations,
  activeRecipient,
  onSelectConversation,
  onOpenNewChat,
  onLogout,
  onUpdateAvatar,
  hoursUntilExpiration = 168,
}) => {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const displayGender = GENDER_MAP[user.gender] || user.gender;

  const handleSelectAvatar = async (avatarId: string | null) => {
    if (onUpdateAvatar) {
      await onUpdateAvatar(avatarId);
    }
  };

  return (
    <div className="w-full sm:w-80 md:w-96 flex flex-col h-full bg-white border-r border-neutral-200 select-none text-neutral-900">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
        <Logo size="sm" showSubtitle={true} />
        <button
          type="button"
          onClick={onOpenNewChat}
          className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white transition shadow-sm active:scale-95 flex items-center gap-1.5"
          title="Start New Conversation"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-bold font-sans hidden sm:inline">New</span>
        </button>
      </div>

      {/* Expiration Policy Banner */}
      <div className="px-4 py-2 bg-neutral-100/70 border-b border-neutral-200 flex items-center justify-between text-[11px] font-mono text-neutral-600">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-900" />
          <span>Account Expiration:</span>
        </div>
        <span className="text-neutral-900 font-bold bg-white px-2 py-0.5 rounded border border-neutral-300">
          {hoursUntilExpiration}h left
        </span>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-mono text-neutral-400 font-bold flex items-center justify-between">
          <span>Conversations</span>
          <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">
            {conversations.length}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-xs space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-neutral-700">No conversations yet</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                You have not started any conversations yet. Your conversations will be remembered here even after 24h messages expire.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewChat}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-900 underline hover:no-underline pt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Start conversation
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeRecipient === conv.canonicalUsername;
            return (
              <button
                key={conv.canonicalUsername}
                type="button"
                onClick={() => onSelectConversation(conv.canonicalUsername)}
                className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all text-left ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-transparent hover:bg-neutral-100 text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <DoodleAvatar
                    avatarId={conv.avatarId}
                    username={conv.username}
                    size="md"
                    isOnline={conv.isOnline}
                    showPresence={true}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm font-mono truncate">
                        @{conv.username}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        isActive ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {conv.lastMessageSnippet || (conv.isOnline ? 'Active E2EE session' : 'Offline • 24h retention')}
                    </p>
                  </div>
                </div>

                {conv.unreadCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      isActive
                        ? 'bg-white text-neutral-900'
                        : 'bg-neutral-900 text-white'
                    }`}
                  >
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Bottom User Profile Section */}
      <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsAvatarPickerOpen(true)}
          className="flex items-center gap-2.5 min-w-0 text-left group hover:opacity-85 transition"
          title="Click to customize doodle avatar"
        >
          <div className="relative">
            <DoodleAvatar
              avatarId={user.avatarId}
              username={user.username}
              size="sm"
            />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-neutral-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Sparkles className="w-2.5 h-2.5" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-900 font-mono truncate group-hover:underline">
              @{user.username}
            </p>
            <p className="text-[10px] text-neutral-500 font-mono">
              Identity: {displayGender}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Link
            href="/privacy"
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition"
            title="Privacy and Security Specifications"
          >
            <Shield className="w-4 h-4" />
          </Link>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition"
            title="Log Out (24h messages remain securely encrypted on device)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        currentAvatarId={user.avatarId}
        username={user.username}
        onClose={() => setIsAvatarPickerOpen(false)}
        onSelectAvatar={handleSelectAvatar}
      />
    </div>
  );
};
