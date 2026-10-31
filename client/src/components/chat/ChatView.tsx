'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ActiveConversation, ChatMessage } from '@/types';
import { EncryptionBadge } from './EncryptionBadge';
import { DoodleAvatar } from '../doodles/avatars/DoodleAvatar';
import { DoodleWallpaper } from '../doodles/DoodleWallpaper';
import { Phone, Send, Lock, ArrowLeft, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { sound } from '@/lib/sound';

interface ChatViewProps {
  conversation: ActiveConversation;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onStartVoiceCall: (recipientUsername: string) => void;
  onBack?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  messages,
  onSendMessage,
  onStartVoiceCall,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      await onSendMessage(text);
      sound.playKeyTick();
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 overflow-hidden relative text-neutral-900">
      {/* Background Doodle Wallpaper */}
      <DoodleWallpaper opacity={0.038} />

      {/* Top Header Bar */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-neutral-200 bg-white/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="sm:hidden p-1.5 -ml-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
              title="Return to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <DoodleAvatar
            avatarId={conversation.avatarId}
            username={conversation.username}
            size="sm"
            isOnline={conversation.isOnline}
            showPresence={true}
          />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-mono text-neutral-900">
                @{conversation.username}
              </h2>
              <EncryptionBadge
                peerUsername={conversation.username}
                keyFingerprint={conversation.keyFingerprint}
              />
            </div>
            <p className="text-[11px] text-neutral-500 font-mono">
              {conversation.isOnline ? 'Online • Live session' : 'Offline • 24h encrypted queue active'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStartVoiceCall(conversation.username)}
            disabled={!conversation.isOnline}
            className="py-2 px-3.5 rounded-xl bg-neutral-100 hover:bg-neutral-900 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-neutral-900 border border-neutral-300 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            title={conversation.isOnline ? 'Start Encrypted Voice Call' : 'Recipient must be online for voice calls'}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Encrypted Call</span>
          </button>
        </div>
      </div>

      {/* 24-Hour Retention Notice Banner */}
      <div className="px-4 py-1.5 bg-neutral-100/90 border-b border-neutral-200/80 flex items-center justify-center gap-2 text-[11px] text-neutral-600 font-mono z-10">
        <Clock className="w-3 h-3 text-neutral-900 shrink-0" />
        <span>E2EE Active. Encrypted on device. Messages are retained for 24 hours then permanently deleted.</span>
      </div>

      {/* Message Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-300 flex items-center justify-center text-neutral-900 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">
                No Recent Messages
              </p>
              <p className="text-xs text-neutral-500 max-w-xs mt-1">
                No messages in the last 24 hours. Messages older than 24 hours have expired and were permanently deleted. Send a message to start chatting with @{conversation.username}!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                  msg.isSelf
                    ? 'bg-neutral-900 text-white rounded-br-sm'
                    : msg.isDecrypted
                    ? 'bg-white text-neutral-900 border border-neutral-200 rounded-bl-sm'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-300 italic rounded-bl-sm'
                }`}
              >
                {!msg.isDecrypted && (
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-neutral-800 not-italic">
                    <AlertTriangle className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                    <span>Cross-Device Session Notice</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap select-text">{msg.text}</p>
              </div>

              <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-neutral-400 font-mono">
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.isSelf && (
                  <span>
                    •{' '}
                    {msg.status === 'delivered' ? (
                      <span className="text-neutral-900 font-bold font-mono">✓✓ delivered</span>
                    ) : msg.status === 'sent' ? (
                      <span className="text-neutral-600 font-medium font-mono">✓ sent</span>
                    ) : msg.status === 'failed' ? (
                      <span className="text-red-600 font-bold font-mono">✗ failed</span>
                    ) : (
                      <span className="text-neutral-400 italic">sending...</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Text Message Composer */}
      <div className="p-3 sm:p-4 border-t border-neutral-200 bg-white z-10">
        <form onSubmit={handleSend} className="flex items-end gap-2 max-w-5xl mx-auto">
          <div className="flex-1 relative rounded-2xl bg-neutral-50 border border-neutral-300 focus-within:bg-white focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10 transition">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              placeholder={
                conversation.isOnline
                  ? `Message @${conversation.username}... (Press Enter to send)`
                  : `Message @${conversation.username}... (Queued for 24h delivery)`
              }
              disabled={isSending}
              rows={1}
              className="w-full px-4 py-3 bg-transparent text-sm text-neutral-900 placeholder-neutral-400 resize-none focus:outline-none max-h-32 min-h-[46px]"
              maxLength={2000}
            />
            {inputText.length > 500 && (
              <span className="absolute right-3 bottom-2 text-[10px] font-mono text-neutral-400">
                {inputText.length}/2000
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition shrink-0 active:scale-95"
            title="Send Encrypted Message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
