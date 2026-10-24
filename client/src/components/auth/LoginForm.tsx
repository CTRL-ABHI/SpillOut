'use client';

import React, { useState } from 'react';
import { MatrixPasswordInput } from './MatrixPasswordInput';
import { api } from '@/lib/api';
import { User } from '@/types';
import { AlertCircle, Loader2, ArrowRight, Lock } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (user: User, token: string) => void;
  onSwitchToSignUp: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState<string[]>(Array(9).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage('Please enter your username');
      return;
    }

    const filledCount = password.filter((c) => c !== '').length;
    if (filledCount !== 9) {
      setErrorMessage('Please fill all 9 cells of your password matrix');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.login({
        username: username.trim(),
        password,
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      onSuccess(res.data.user, res.data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white border border-neutral-300 shadow-panel space-y-6 text-neutral-900 transition-all"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-mono text-neutral-700 mb-2.5">
          <Lock className="w-3.5 h-3.5 text-neutral-900" />
          <span>Encrypted Session Access</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-1">
          Welcome back
        </h2>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Enter your unique username and 9-position character matrix to decrypt your session.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-900 text-xs text-neutral-900 flex items-start gap-2.5 animate-fade-in font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-neutral-900" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Username */}
      <div>
        <label className="block text-xs uppercase tracking-wider font-semibold text-neutral-700 mb-1.5 font-sans">
          Username
        </label>
        <input
          type="text"
          maxLength={10}
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
          placeholder="e.g. Abhi123"
          className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-300 focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 text-sm text-neutral-900 placeholder-neutral-400 font-mono transition"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>

      {/* 3x3 Matrix Password */}
      <div>
        <MatrixPasswordInput
          value={password}
          onChange={setPassword}
          label="Password Matrix"
          idPrefix="login-pwd"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !username.trim() || password.filter(Boolean).length !== 9}
        className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Verifying Credentials...</span>
          </>
        ) : (
          <>
            <span>Log In to SpillOut</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="text-center pt-1 border-t border-neutral-100">
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-xs text-neutral-600 hover:text-neutral-900 transition font-sans"
        >
          Do not have an account? <span className="font-bold underline text-neutral-900">Create one</span>
        </button>
      </div>
    </form>
  );
};
