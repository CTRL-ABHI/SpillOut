'use client';

import React from 'react';
import { ActiveConversation, User } from '@/types';
import { Logo } from '../branding/Logo';
import { Plus, Shield, LogOut, Clock, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface ConversationListProps {
  user: User;
  conversations: ActiveConversation[];
  activeRecipient: string | null;
  onSelectConversation: (canonicalUsername: string) => void;
  onOpenNewChat: () => void;
  onLogout: () => void;
  hoursUntilExpiration?: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  user,
  conversations,
  activeRecipient,
  onSelectConversation,
  onOpenNewChat,
  onLogout,
  hoursUntilExpiration = 168,
}) => {
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

      {/* 7-Day Inactivity Banner */}
      <div className="px-4 py-2 bg-neutral-100/70 border-b border-neutral-200 flex items-center justify-between text-[11px] font-mono text-neutral-600">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-900" />
          <span>7-Day Expiration:</span>
        </div>
        <span className="text-neutral-900 font-bold bg-white px-2 py-0.5 rounded border border-neutral-300">
          {hoursUntilExpiration}h left
        </span>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-mono text-neutral-400 font-bold flex items-center justify-between">
          <span>Active In-Memory Sessions</span>
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
              <p className="font-semibold text-neutral-700">No active conversations</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Chats are ephemeral and never stored on disk.
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
                  <div className="relative shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                        isActive
                          ? 'bg-neutral-800 text-white border border-neutral-700'
                          : 'bg-neutral-100 text-neutral-900 border border-neutral-300'
                      }`}
                    >
                      {conv.username.slice(0, 2).toUpperCase()}
                    </div>
                    {/* Monochrome Online Presence Dot */}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                        isActive ? 'border-neutral-900' : 'border-white'
                      } ${
                        conv.isOnline
                          ? isActive ? 'bg-white' : 'bg-neutral-900'
                          : 'bg-neutral-300'
                      }`}
                      title={conv.isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

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
                      {conv.lastMessageSnippet || (conv.isOnline ? 'Ready for E2EE' : 'Offline')}
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

      {/* Bottom User Footer */}
      <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center font-mono font-bold text-neutral-900 text-xs shrink-0">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-900 font-mono truncate">
              @{user.username}
            </p>
            <p className="text-[10px] text-neutral-500 font-mono">
              Gender: {user.gender}
            </p>
          </div>
        </div>

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
            title="Log Out & Evaporate Ephemeral Memory"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
