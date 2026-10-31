'use client';

import React, { useState } from 'react';
import { DOODLE_AVATARS } from './avatar-data';
import { DoodleAvatar } from './DoodleAvatar';
import { X, Check, Sparkles } from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentAvatarId?: string | null;
  username: string;
  onClose: () => void;
  onSelectAvatar: (avatarId: string | null) => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatarId,
  username,
  onClose,
  onSelectAvatar,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(currentAvatarId || null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSelectAvatar(selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none text-neutral-900">
      <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-white border border-neutral-300 shadow-modal text-left space-y-5 animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-neutral-900">
                Choose Doodle Character
              </h3>
              <p className="text-xs text-neutral-500 font-mono">
                Optional profile picture for @{username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Bar */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center gap-3">
          <DoodleAvatar
            avatarId={selectedId}
            username={username}
            size="lg"
            className="shrink-0"
          />
          <div>
            <p className="text-xs font-bold text-neutral-900">Preview</p>
            <p className="text-[11px] text-neutral-500">
              {selectedId
                ? DOODLE_AVATARS.find((a) => a.id === selectedId)?.name || 'Custom Doodle'
                : 'Default Initials Monogram'}
            </p>
          </div>
        </div>

        {/* Avatar Grid */}
        <div className="max-h-64 overflow-y-auto p-1 grid grid-cols-4 sm:grid-cols-6 gap-2.5">
          {/* Default No-Avatar Option */}
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
              selectedId === null
                ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm ring-2 ring-neutral-900/20'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400'
            }`}
            title="Use Default Monogram"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs border ${
              selectedId === null ? 'border-white text-white' : 'border-neutral-300 bg-neutral-100 text-neutral-900'
            }`}>
              {username.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[9px] font-mono font-bold truncate max-w-full">
              Initials
            </span>
          </button>

          {/* 16 Hand-Drawn Doodle Characters */}
          {DOODLE_AVATARS.map((avatar) => {
            const isSelected = selectedId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedId(avatar.id)}
                className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm ring-2 ring-neutral-900/20'
                    : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-400'
                }`}
                title={avatar.name}
              >
                <div className={`w-9 h-9 rounded-full p-0.5 flex items-center justify-center border ${
                  isSelected ? 'border-white text-white' : 'border-neutral-300 bg-neutral-100 text-neutral-900'
                }`}>
                  {avatar.render('w-full h-full')}
                </div>
                <span className="text-[9px] font-mono truncate max-w-full font-medium">
                  {avatar.name.replace('The ', '')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Avatar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

