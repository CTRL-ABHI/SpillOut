import React from 'react';

export interface DoodleAvatarInfo {
  id: string;
  name: string;
  render: (className?: string) => React.ReactElement;
}

export const DOODLE_AVATARS: DoodleAvatarInfo[] = [
  {
    id: 'avatar_01',
    name: 'The Thinker',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Head */}
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" strokeDasharray="98 2" />
        {/* Wavy Hair */}
        <path d="M22 36C26 22 38 18 50 18C62 18 74 22 78 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 20C34 14 44 12 50 12C56 12 66 14 70 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Glasses */}
        <circle cx="36" cy="48" r="10" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="64" cy="48" r="10" stroke="currentColor" strokeWidth="2.5" />
        <path d="M46 48H54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Pupils */}
        <circle cx="36" cy="48" r="2.5" fill="currentColor" />
        <circle cx="64" cy="48" r="2.5" fill="currentColor" />
        {/* Smile */}
        <path d="M42 68C46 72 54 72 58 68" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_02',
    name: 'The Cool Dood',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Spiky Messy Hair */}
        <path d="M24 38L32 20L42 28L52 16L62 26L72 18L76 38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dark Sunglasses */}
        <polygon points="26,45 46,45 43,58 29,58" fill="currentColor" />
        <polygon points="54,45 74,45 71,58 57,58" fill="currentColor" />
        <path d="M46 48H54" stroke="currentColor" strokeWidth="3" />
        {/* Smirk */}
        <path d="M44 72C48 74 58 74 62 68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_03',
    name: 'The Dreamer',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Cloud Hair */}
        <path d="M24 36C20 28 26 18 36 20C42 14 58 14 64 20C74 18 80 28 76 36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Star Eyes */}
        <path d="M35 44L37 50L43 52L37 54L35 60L33 54L27 52L33 50Z" fill="currentColor" />
        <path d="M65 44L67 50L73 52L67 54L65 60L63 54L57 52L63 50Z" fill="currentColor" />
        {/* Cute Open Smile */}
        <path d="M44 68C44 74 56 74 56 68" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_04',
    name: 'The Mystery',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Deep Hoodie Contour */}
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        <path d="M20 54C20 26 30 16 50 16C70 16 80 26 80 54C76 76 68 84 50 84C32 84 24 76 20 54Z" stroke="currentColor" strokeWidth="3" fill="currentColor" fillOpacity="0.06" />
        {/* Piercing Curious Eyes in Shadow */}
        <circle cx="38" cy="48" r="3.5" fill="currentColor" />
        <circle cx="62" cy="48" r="3.5" fill="currentColor" />
        {/* Secret Grin */}
        <path d="M42 66C47 70 53 70 58 66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_05',
    name: 'The Spark',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Wild Electric Hair */}
        <path d="M26 34L34 16L40 26L50 12L60 26L68 14L74 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Wide Alert Eyes */}
        <circle cx="36" cy="48" r="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="64" cy="48" r="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="36" cy="48" r="2.5" fill="currentColor" />
        <circle cx="64" cy="48" r="2.5" fill="currentColor" />
        {/* Lightning Cheeks */}
        <path d="M22 58L26 62L24 66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M78 58L74 62L76 66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Grin */}
        <path d="M40 70H60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_06',
    name: 'The Beanie',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Slouchy Beanie */}
        <path d="M20 38C20 18 32 14 50 14C68 14 80 18 80 38" stroke="currentColor" strokeWidth="3" fill="currentColor" fillOpacity="0.08" />
        <path d="M16 38H84" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        {/* Friendly Eyes */}
        <path d="M32 50C34 46 40 46 42 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M58 50C60 46 66 46 68 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        {/* Freckles */}
        <circle cx="28" cy="58" r="1.5" fill="currentColor" />
        <circle cx="32" cy="61" r="1.5" fill="currentColor" />
        <circle cx="68" cy="61" r="1.5" fill="currentColor" />
        <circle cx="72" cy="58" r="1.5" fill="currentColor" />
        {/* Gentle Curve Mouth */}
        <path d="M44 68C48 72 52 72 56 68" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_07',
    name: 'The Beret Artist',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Tilted Beret */}
        <path d="M18 36C20 20 45 15 65 18C85 21 86 36 78 40C68 44 26 44 18 36Z" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.08" />
        <circle cx="60" cy="16" r="2.5" fill="currentColor" />
        {/* Eyes */}
        <circle cx="36" cy="52" r="3" fill="currentColor" />
        <circle cx="64" cy="52" r="3" fill="currentColor" />
        {/* Little French Mustache */}
        <path d="M40 64C46 62 48 65 50 67C52 65 54 62 60 64" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_08',
    name: 'The Joy',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Big Laughing Curved Eyes (^_^) */}
        <path d="M28 48C32 40 40 40 44 48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M56 48C60 40 68 40 72 48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        {/* Big Happy Laugh Mouth */}
        <path d="M34 60C34 76 66 76 66 60Z" stroke="currentColor" strokeWidth="3" fill="currentColor" fillOpacity="0.12" strokeLinejoin="round" />
        {/* Blush marks */}
        <path d="M20 56L26 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M74 56L80 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_09',
    name: 'The Robot Pal',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Antenna */}
        <path d="M50 24V14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="12" r="3" fill="currentColor" />
        {/* Boxy Robot Head */}
        <rect x="26" y="26" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="3" />
        {/* Square Pixel Eyes */}
        <rect x="34" y="38" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="58" y="38" width="8" height="8" rx="2" fill="currentColor" />
        {/* Grid Mouth */}
        <path d="M38 58H62" stroke="currentColor" strokeWidth="2.5" />
        <path d="M44 55V61" stroke="currentColor" strokeWidth="2" />
        <path d="M50 55V61" stroke="currentColor" strokeWidth="2" />
        <path d="M56 55V61" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'avatar_10',
    name: 'The Friendly Ghost',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Sheet Ghost Body */}
        <path d="M30 68C26 40 32 24 50 24C68 24 74 40 70 68C66 65 62 65 58 68C54 65 50 65 46 68C42 65 38 65 34 68C32 68 31 68 30 68Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.05" />
        {/* Oval Eyes */}
        <ellipse cx="43" cy="42" rx="3.5" ry="5.5" fill="currentColor" />
        <ellipse cx="57" cy="42" rx="3.5" ry="5.5" fill="currentColor" />
        {/* Little O mouth */}
        <ellipse cx="50" cy="54" rx="2.5" ry="3.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'avatar_11',
    name: 'The Cat Person',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Cat Ears */}
        <polygon points="26,38 32,18 44,30" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.08" />
        <polygon points="74,38 68,18 56,30" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.08" />
        {/* Big Cat Eyes */}
        <ellipse cx="38" cy="48" rx="5" ry="7" stroke="currentColor" strokeWidth="2.5" />
        <ellipse cx="62" cy="48" rx="5" ry="7" stroke="currentColor" strokeWidth="2.5" />
        <ellipse cx="38" cy="48" rx="2" ry="5" fill="currentColor" />
        <ellipse cx="62" cy="48" rx="2" ry="5" fill="currentColor" />
        {/* Nose & Whiskers */}
        <polygon points="48,58 52,58 50,60" fill="currentColor" />
        <path d="M46 62C48 64 50 64 50 61C50 64 52 64 54 62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 56L34 58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M22 62L34 61" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M78 56L66 58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M78 62L66 61" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_12',
    name: 'The Gentleman',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Top Hat */}
        <path d="M30 30L34 10H66L70 30" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.1" strokeLinejoin="round" />
        <path d="M22 30H78" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        {/* Monocle on right eye */}
        <circle cx="36" cy="48" r="3" fill="currentColor" />
        <circle cx="64" cy="48" r="8" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="64" cy="48" r="3" fill="currentColor" />
        <path d="M72 48C76 54 74 66 70 72" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Handlebar mustache */}
        <path d="M38 64C44 60 49 65 50 65C51 65 56 60 62 64" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_13',
    name: 'The Zen',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Top Hair Bun */}
        <circle cx="50" cy="18" r="7" stroke="currentColor" strokeWidth="2.5" />
        {/* Serene Closed Eyes */}
        <path d="M32 50C36 54 42 54 46 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M54 50C58 54 64 54 68 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        {/* Gentle Peaceful Smile */}
        <path d="M44 66C48 70 52 70 56 66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_14',
    name: 'The Cosmic Dood',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* 3 Eyes */}
        <circle cx="34" cy="50" r="5" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="34" cy="50" r="2.5" fill="currentColor" />
        <circle cx="50" cy="40" r="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="50" cy="40" r="3" fill="currentColor" />
        <circle cx="66" cy="50" r="5" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="66" cy="50" r="2.5" fill="currentColor" />
        {/* Little Cosmic Planet Ring behind */}
        <ellipse cx="50" cy="70" rx="20" ry="5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        {/* Happy Wavy Smile */}
        <path d="M42 66C46 68 54 64 58 66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_15',
    name: 'The Playful Wink',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Wild Curls */}
        <path d="M26 36C22 24 34 16 46 22C52 14 66 16 72 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Left eye open with shine */}
        <circle cx="36" cy="48" r="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="36" cy="48" r="3" fill="currentColor" />
        {/* Right eye wink */}
        <path d="M58 48L64 52L70 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Tongue out mouth */}
        <path d="M42 64H58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M46 64C46 72 54 72 54 64" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'avatar_16',
    name: 'The Cloud Puff',
    render: (className = 'w-full h-full') => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="3" />
        {/* Fluffy Cloud Character Inside */}
        <path d="M30 58C24 58 20 52 24 44C22 36 30 28 38 32C42 22 58 22 62 32C70 28 78 36 76 44C80 52 76 58 70 58Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.06" />
        {/* Dot Eyes */}
        <circle cx="42" cy="46" r="2.5" fill="currentColor" />
        <circle cx="58" cy="46" r="2.5" fill="currentColor" />
        {/* Cute Tiny Smile */}
        <path d="M48 51C49 53 51 53 52 51" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export const AVATAR_MAP = new Map<string, DoodleAvatarInfo>(
  DOODLE_AVATARS.map((av) => [av.id, av])
);

