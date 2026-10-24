'use client';

import React from 'react';

interface DoodleWallpaperProps {
  opacity?: number; // e.g. 0.04 (4%)
  inverted?: boolean;
  className?: string;
}

export const DoodleWallpaper: React.FC<DoodleWallpaperProps> = ({
  opacity = 0.045,
  inverted = false,
  className = '',
}) => {
  const strokeColor = inverted ? '#FFFFFF' : '#111111';

  return (
    <div
      aria-hidden="true"
      style={{ opacity }}
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden z-0 ${className}`}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id={`doodle-pattern-${inverted ? 'dark' : 'light'}`}
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Speech bubble doodle */}
            <path
              d="M30 40 C30 28, 45 28, 60 28 C75 28, 85 36, 85 48 C85 60, 72 65, 55 65 C48 65, 42 68, 32 74 C34 67, 34 65, 30 62 C26 56, 30 45, 30 40 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M45 44 H70"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M45 52 H62"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* 2. Star sparkles */}
            <path
              d="M135 30 L138 42 L150 45 L138 48 L135 60 L132 48 L120 45 L132 42 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M200 90 L202 98 L210 100 L202 102 L200 110 L198 102 L190 100 L198 98 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* 3. Tiny scribble heart */}
            <path
              d="M190 35 C185 25, 170 28, 170 38 C170 48, 190 62, 190 62 C190 62, 210 48, 210 38 C210 28, 195 25, 190 35 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 4. Hand-drawn arrow */}
            <path
              d="M35 155 C50 145, 75 148, 90 160 M80 152 L92 161 L82 168"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 5. Ink drop / spill splashes */}
            <circle cx="105" cy="95" r="3.5" fill={strokeColor} />
            <circle cx="115" cy="88" r="2" fill={strokeColor} />
            <circle cx="98" cy="102" r="1.5" fill={strokeColor} />

            {/* 6. Scribble coil / loop */}
            <path
              d="M140 145 C150 135, 165 140, 160 155 C155 170, 175 170, 185 155"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* 7. Secret lock doodle */}
            <rect
              x="35"
              y="200"
              width="24"
              height="18"
              rx="4"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.8"
            />
            <path
              d="M41 200 V194 C41 190, 53 190, 53 194 V200"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="47" cy="209" r="1.5" fill={strokeColor} />

            {/* 8. Asterisk / spark */}
            <path
              d="M110 195 V215 M100 205 H120 M103 198 L117 212 M117 198 L103 212"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* 9. Wavy squiggle */}
            <path
              d="M165 210 Q175 200, 185 210 T205 210 T225 210"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* 10. Tiny smiley wink doodle */}
            <circle cx="85" cy="115" r="12" fill="none" stroke={strokeColor} strokeWidth="1.6" />
            <circle cx="81" cy="112" r="1.2" fill={strokeColor} />
            <path d="M87 111 L91 113 L87 115" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M81 119 Q85 123, 89 119" fill="none" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" />
          </pattern>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#doodle-pattern-${inverted ? 'dark' : 'light'})`}
        />
      </svg>
    </div>
  );
};
