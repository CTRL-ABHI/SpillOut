'use client';

import React, { useState, useEffect } from 'react';
import { EyeOff, ShieldCheck } from 'lucide-react';

interface BlurOverlayProps {
  enabled?: boolean;
}

export const BlurOverlay: React.FC<BlurOverlayProps> = ({ enabled = true }) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsBlurred(true);
      }
    };

    const handleWindowBlur = () => {
      setIsBlurred(true);
    };

    const handleWindowFocus = () => {
      // Keep blurred until deliberate user click for confidentiality
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled]);

  if (!isBlurred) return null;

  return (
    <div
      onClick={() => setIsBlurred(false)}
      className="fixed inset-0 z-50 bg-white/70 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer animate-fade-in text-neutral-900"
    >
      <div className="p-7 rounded-3xl bg-white border-2 border-neutral-900 shadow-sketch-lg max-w-sm space-y-3 pointer-events-none">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-sm">
          <EyeOff className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-extrabold text-neutral-900">
          Screen Shield Active
        </h3>
        <p className="text-xs text-neutral-500 leading-relaxed font-sans">
          Content was automatically obscured when the window lost focus to protect against shoulder-surfing and casual screen capture.
        </p>
        <div className="pt-2">
          <span className="inline-block px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-300 text-[11px] font-mono font-bold text-neutral-900 uppercase tracking-wider">
            Click anywhere to reveal ✦
          </span>
        </div>
      </div>
    </div>
  );
};
