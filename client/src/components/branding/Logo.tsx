'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  inverted?: boolean;
  symbolOnly?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = false,
  inverted = false,
  symbolOnly = false,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const wordmarkSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }[size];

  const fgColor = inverted ? '#FFFFFF' : '#111111';
  const bgColor = inverted ? '#111111' : '#FFFFFF';
  const textColor = inverted ? 'text-white' : 'text-neutral-900';
  const subtextColor = inverted ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div className={`inline-flex flex-col items-start select-none group ${className}`}>
      <div className="flex items-center gap-2.5">
        {/* SpillOut Custom SVG Mark: Speech bubble + ink-spill conversation escaping */}
        <div className={`relative shrink-0 ${iconDimensions} transition-transform duration-200 group-hover:scale-105`}>
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Outer sketchbook doodle border / shadow */}
            <path
              d="M10 13C10 9.68629 12.6863 7 16 7H32C35.3137 7 38 9.68629 38 13V25C38 28.3137 35.3137 31 32 31H21L12 39V31H16C12.6863 31 10 28.3137 10 25V13Z"
              fill={fgColor}
            />

            {/* Ink spill burst escaping the container */}
            <path
              d="M33 5.5C36 3.5 40 4.5 41 8C41.8 10.8 38.5 13 36 12"
              stroke={fgColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Ink droplets spilling out */}
            <circle cx="43" cy="5" r="1.5" fill={fgColor} />
            <circle cx="39" cy="2.5" r="1" fill={fgColor} />

            {/* Conversation lines inside bubble */}
            <path
              d="M17 16.5H31"
              stroke={bgColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M17 21.5H26.5"
              stroke={bgColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Brand Wordmark */}
        {!symbolOnly && (
          <div className="flex flex-col">
            <div className="flex items-center gap-1 leading-none">
              <span className={`font-extrabold tracking-tight font-sans ${wordmarkSizes} ${textColor}`}>
                Spill<span className="font-light italic tracking-normal">Out</span>
              </span>
              {/* Little hand-drawn star doodle */}
              <svg
                className="w-3.5 h-3.5 text-current opacity-80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {showSubtitle && !symbolOnly && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 inline-block" />
          <span className={`text-[10px] tracking-widest uppercase font-mono font-semibold ${subtextColor}`}>
            Zero-Archive • Ephemeral Comms
          </span>
        </div>
      )}
    </div>
  );
};
