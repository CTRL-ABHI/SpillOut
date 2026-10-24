'use client';

import React from 'react';

export const AuthSketchHero: React.FC = () => {
  return (
    <div className="relative w-full max-w-lg aspect-square p-6 flex flex-col items-center justify-center select-none">
      {/* Decorative Outer Sketch Container */}
      <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-neutral-300 bg-neutral-50/70" />

      {/* Main Hand-drawn Composition SVG */}
      <svg
        viewBox="0 0 460 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10"
      >
        {/* 1. Large Central Hand-drawn Speech Bubble */}
        <g className="transition-transform duration-300 hover:scale-[1.02]">
          <path
            d="M80 120 C80 75, 120 60, 230 60 C340 60, 380 75, 380 120 C380 165, 340 185, 250 185 C210 185, 175 205, 130 235 C138 200, 132 185, 110 180 C85 170, 80 145, 80 120 Z"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hand-drawn scribble lines inside speech bubble */}
          <path
            d="M125 105 H335"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M125 125 H290"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M125 145 H210"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* 2. Ink Spill & Burst Motif Spilling Out */}
        <path
          d="M345 55 C370 30, 415 45, 410 85 C405 110, 375 115, 360 95"
          stroke="#111111"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Droplets */}
        <circle cx="420" cy="50" r="4.5" fill="#111111" />
        <circle cx="435" cy="75" r="3" fill="#111111" />
        <circle cx="395" cy="30" r="2.5" fill="#111111" />

        {/* 3. Hand-drawn 3x3 Matrix Mini Doodle */}
        <g transform="translate(60, 240)">
          {/* Sketchy card */}
          <rect
            x="0"
            y="0"
            width="140"
            height="140"
            rx="18"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="2.5"
          />
          {/* 9 cells */}
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={16 + c * 38}
                y={16 + r * 38}
                width="32"
                height="32"
                rx="7"
                fill={r === 1 && c === 1 ? '#111111' : (r + c) % 2 === 0 ? '#F7F7F7' : '#FFFFFF'}
                stroke="#111111"
                strokeWidth="1.8"
              />
            ))
          )}
          {/* Active cell mark */}
          <circle cx="70" cy="70" r="4" fill="#FFFFFF" />
        </g>

        {/* 4. Hand-drawn Padlock Symbol (E2EE) */}
        <g transform="translate(260, 235)">
          <rect
            x="30"
            y="45"
            width="110"
            height="90"
            rx="16"
            fill="#111111"
            stroke="#111111"
            strokeWidth="2.5"
          />
          {/* Shackle */}
          <path
            d="M50 45 V25 C50 10, 120 10, 120 25 V45"
            fill="none"
            stroke="#111111"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Keyhole */}
          <circle cx="85" cy="80" r="7" fill="#FFFFFF" />
          <path d="M85 85 V102" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* 5. Hand-drawn Arrows & Handwritten Annotation Badges */}
        {/* Arrow to 3x3 */}
        <path
          d="M210 270 Q215 285, 205 300 M200 290 L205 302 L216 295"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sketch Star Doodles */}
        <path
          d="M55 70 L58 84 L72 87 L58 90 L55 104 L52 90 L38 87 L52 84 Z"
          fill="#111111"
        />
        <path
          d="M400 220 L402 230 L412 232 L402 234 L400 244 L398 234 L388 232 L398 230 Z"
          fill="#111111"
        />

        {/* Scribbled underline */}
        <path
          d="M130 405 Q220 395, 330 405 T400 402"
          stroke="#111111"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Little handwritten heart */}
        <path
          d="M225 355 C220 345, 205 348, 205 358 C205 368, 225 380, 225 380 C225 380, 245 368, 245 358 C245 348, 230 345, 225 355 Z"
          fill="#111111"
        />
      </svg>

      {/* Floating Monochrome Sketch Badges */}
      <div className="absolute top-8 right-6 px-3.5 py-1.5 rounded-full bg-white border border-neutral-900 shadow-sketch-sm text-[11px] font-mono font-bold text-neutral-900 rotate-2">
        Zero Trace ✦
      </div>

      <div className="absolute bottom-10 left-6 px-3.5 py-1.5 rounded-full bg-neutral-900 text-white shadow-sketch-sm text-[11px] font-mono font-bold -rotate-3">
        3×3 Matrix Password
      </div>

      <div className="absolute top-1/2 -left-2 px-3 py-1 rounded-full bg-white border border-neutral-900 text-[10px] font-mono text-neutral-800 -rotate-12 shadow-sm">
        WebRTC DTLS-SRTP
      </div>
    </div>
  );
};
