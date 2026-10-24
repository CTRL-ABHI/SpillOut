'use client';

import React, { useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, CornerDownLeft } from 'lucide-react';
import { sound } from '@/lib/sound';

interface MatrixPasswordInputProps {
  value: string[]; // Exactly 9 strings
  onChange: (cells: string[]) => void;
  label?: string;
  error?: string;
  idPrefix?: string;
}

export const MatrixPasswordInput: React.FC<MatrixPasswordInputProps> = ({
  value,
  onChange,
  label = '3×3 Password Matrix',
  error,
  idPrefix = 'pwd-cell',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Ensure value has length 9
  const cells = value.length === 9 ? value : Array(9).fill('');
  const filledCount = cells.filter((c) => c !== '').length;

  const handleCellChange = (index: number, char: string) => {
    // If multiple characters (e.g. from mobile autocomplete), take the last character
    const singleChar = char.length > 0 ? char.slice(-1) : '';

    const newCells = [...cells];
    newCells[index] = singleChar;
    onChange(newCells);

    sound.playKeyTick();

    // Auto-advance to next empty cell if a character was entered
    if (singleChar && index < 8) {
      let nextIndex = index + 1;
      for (let i = index + 1; i < 9; i++) {
        if (!newCells[i]) {
          nextIndex = i;
          break;
        }
      }
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!cells[index] && index > 0) {
        // Current cell empty: move backward and clear previous
        e.preventDefault();
        const newCells = [...cells];
        newCells[index - 1] = '';
        onChange(newCells);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current cell
        const newCells = [...cells];
        newCells[index] = '';
        onChange(newCells);
      }
      sound.playKeyTick();
      return;
    }

    // Grid Arrow Navigation (3x3 grid)
    if (e.key === 'ArrowRight' && index < 8) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowDown' && index + 3 < 9) {
      e.preventDefault();
      inputRefs.current[index + 3]?.focus();
    } else if (e.key === 'ArrowUp' && index - 3 >= 0) {
      e.preventDefault();
      inputRefs.current[index - 3]?.focus();
    } else if (e.key === ' ') {
      // Space key handler
      e.preventDefault();
      handleCellChange(index, ' ');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const chars = Array.from(pastedText).slice(0, 9);
    const newCells = [...cells];
    for (let i = 0; i < chars.length; i++) {
      newCells[i] = chars[i];
    }
    onChange(newCells);
    sound.playKeyTick();

    // Focus last filled index or next
    const targetFocus = Math.min(chars.length, 8);
    inputRefs.current[targetFocus]?.focus();
  };

  const clearGrid = () => {
    onChange(Array(9).fill(''));
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="w-full">
      {/* Top Header & Toggles */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-wider font-semibold text-neutral-800 flex items-center gap-1.5 font-sans">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-neutral-500 font-mono px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
            {filledCount}/9
          </span>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-[11px] text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1 font-mono hover:underline"
            title={showPassword ? 'Mask characters' : 'Show characters'}
          >
            {showPassword ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Mask</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3x3 Matrix Grid Container */}
      <div
        className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-300 shadow-sm max-w-[280px] sm:max-w-[300px] mx-auto transition-all"
        onPaste={handlePaste}
      >
        {Array.from({ length: 9 }).map((_, index) => {
          const char = cells[index] || '';
          const isSpace = char === ' ';
          const isFilled = char !== '';

          return (
            <div
              key={index}
              className={`relative aspect-square rounded-xl flex items-center justify-center border-2 transition-all duration-150 ${
                isFilled
                  ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                  : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-900'
              } focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/20 focus-within:ring-offset-1`}
            >
              <input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                id={`${idPrefix}-${index}`}
                type="text"
                maxLength={1}
                value={showPassword ? char : char ? '•' : ''}
                onChange={(e) => handleCellChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-full h-full bg-transparent text-center text-lg sm:text-xl font-mono font-bold focus:outline-none cursor-text select-all ${
                  isFilled ? 'text-white' : 'text-neutral-900'
                }`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={`Matrix cell ${index + 1} of 9`}
              />

              {/* Discreet visual indicator for space character */}
              {isSpace && (
                <div className="absolute bottom-1 text-[8px] font-mono tracking-tighter px-1 rounded bg-white text-neutral-900 font-bold pointer-events-none">
                  SPACE
                </div>
              )}

              {/* Cell index watermark for empty cells */}
              {!isFilled && (
                <span className="absolute top-1 right-1.5 text-[9px] font-mono text-neutral-400 pointer-events-none select-none">
                  {index + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Helper notes / Error state */}
      <div className="mt-2 flex items-center justify-between text-xs">
        {error ? (
          <p className="text-neutral-900 font-semibold flex items-center gap-1 text-[11px]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-900" />
            {error}
          </p>
        ) : (
          <p className="text-neutral-500 text-[11px]">
            Letters, digits, symbols & spaces accepted.
          </p>
        )}
        {filledCount > 0 && (
          <button
            type="button"
            onClick={clearGrid}
            className="text-neutral-600 hover:text-neutral-900 transition underline text-[11px] font-mono"
          >
            Clear grid
          </button>
        )}
      </div>
    </div>
  );
};
