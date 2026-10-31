'use client';

import React from 'react';
import { AVATAR_MAP } from './avatar-data';

interface DoodleAvatarProps {
  avatarId?: string | null;
  username: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showPresence?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]', presence: 'w-2 h-2' },
  sm: { container: 'w-9 h-9', text: 'text-xs', presence: 'w-2.5 h-2.5' },
  md: { container: 'w-10 h-10', text: 'text-xs', presence: 'w-3 h-3' },
  lg: { container: 'w-14 h-14', text: 'text-base', presence: 'w-3.5 h-3.5' },
  xl: { container: 'w-20 h-20', text: 'text-2xl', presence: 'w-4 h-4' },
};

export const DoodleAvatar: React.FC<DoodleAvatarProps> = ({
  avatarId,
  username,
  size = 'md',
  isOnline = false,
  showPresence = false,
  className = '',
}) => {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const avatar = avatarId ? AVATAR_MAP.get(avatarId) : null;
  const monogram = (username || '??').slice(0, 2).toUpperCase();

  return (
    <div className={`relative shrink-0 ${cfg.container} ${className}`}>
      <div
        className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-100 text-neutral-900 shadow-sm transition`}
      >
        {avatar ? (
          <div className="w-full h-full p-1 flex items-center justify-center text-neutral-900">
            {avatar.render('w-full h-full')}
          </div>
        ) : (
          <span className={`font-mono font-bold select-none ${cfg.text}`}>
            {monogram}
          </span>
        )}
      </div>

      {showPresence && (
        <span
          className={`absolute bottom-0 right-0 ${cfg.presence} rounded-full border-2 border-white ${
            isOnline ? 'bg-neutral-900' : 'bg-neutral-300'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

