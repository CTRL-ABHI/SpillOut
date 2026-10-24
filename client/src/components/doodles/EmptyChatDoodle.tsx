'use client';

import React from 'react';

export const EmptyChatDoodle: React.FC = () => {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center select-none pointer-events-none">
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background speech bubble doodle */}
        <path
          d="M35 55 C35 35, 55 25, 100 25 C145 25, 165 35, 165 55 C165 75, 145 90, 110 90 C95 90, 80 98, 60 110 C65 96, 62 90, 50 88 C38 84, 35 70, 35 55 Z"
          fill="#F7F7F7"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ink splash overflowing */}
        <path
          d="M148 24 C160 12, 178 18, 175 34"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="182" cy="20" r="2" fill="#111111" />
        <circle cx="170" cy="12" r="1.5" fill="#111111" />

        {/* Central padlocked envelope / paper note doodle */}
        <g transform="translate(60, 80)">
          <rect
            x="0"
            y="0"
            width="80"
            height="70"
            rx="12"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="2.2"
          />
          {/* Fold flap */}
          <path
            d="M5 5 L40 38 L75 5"
            stroke="#111111"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Padlock icon over envelope */}
          <rect
            x="28"
            y="35"
            width="24"
            height="20"
            rx="5"
            fill="#111111"
          />
          <path
            d="M33 35 V28 C33 24, 47 24, 47 28 V35"
            fill="none"
            stroke="#111111"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="40" cy="44" r="1.5" fill="#FFFFFF" />
        </g>

        {/* Hand-drawn sparkles */}
        <path
          d="M25 130 L27 138 L35 140 L27 142 L25 150 L23 142 L15 140 L23 138 Z"
          fill="#111111"
        />
        <path
          d="M165 140 L167 146 L173 148 L167 150 L165 156 L163 150 L157 148 L163 146 Z"
          fill="#111111"
        />

        {/* Tiny scribble arrow */}
        <path
          d="M130 170 C110 180, 85 178, 70 168 M78 162 L68 168 L76 176"
          stroke="#111111"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
