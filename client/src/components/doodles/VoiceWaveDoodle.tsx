'use client';

import React from 'react';

interface VoiceWaveDoodleProps {
  active?: boolean;
}

export const VoiceWaveDoodle: React.FC<VoiceWaveDoodleProps> = ({ active = true }) => {
  return (
    <div className="w-full max-w-[260px] h-14 mx-auto flex items-center justify-center select-none">
      <svg
        viewBox="0 0 240 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-neutral-900"
      >
        {/* Minimal hand-drawn waveform doodle line */}
        <path
          d="M10 25 Q20 25, 30 25 T50 15 T70 35 T90 8 T110 42 T130 5 T150 45 T170 12 T190 38 T210 25 T230 25"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={active ? 'animate-pulse' : 'opacity-40'}
        />

        {/* Little hand-drawn audio sparkles on top */}
        <path
          d="M125 0 L127 5 L132 6 L127 7 L125 12 L123 7 L118 6 L123 5 Z"
          fill="currentColor"
          className={active ? 'opacity-90' : 'opacity-0'}
        />
        <circle cx="95" cy="5" r="1.5" fill="currentColor" />
        <circle cx="145" cy="48" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
};
