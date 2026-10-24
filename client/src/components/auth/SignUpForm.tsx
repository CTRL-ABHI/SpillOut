'use client';

import React, { useState, useEffect } from 'react';
import { MatrixPasswordInput } from './MatrixPasswordInput';
import { api } from '@/lib/api';
import { getOrCreateIdentityKeyPair } from '@/lib/crypto';
import { Gender, User } from '@/types';
import { Check, AlertCircle, Loader2, ArrowRight, ShieldAlert, Sparkles, ShieldCheck } from 'lucide-react';

interface SignUpFormProps {
  onSuccess: (user: User, token: string) => void;
  onSwitchToLogin: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    valid: boolean;
    available: boolean;
    error?: string;
  }>({
    checking: false,
    valid: false,
    available: false,
  });

  const [password, setPassword] = useState<string[]>(Array(9).fill(''));
  const [confirmPassword, setConfirmPassword] = useState<string[]>(Array(9).fill(''));
  const [gender, setGender] = useState<Gender | ''>('');
  const [acknowledgedPolicy, setAcknowledgedPolicy] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [registeredData, setRegisteredData] = useState<{ user: User; token: string } | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus({ checking: false, valid: false, available: false });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus((prev) => ({ ...prev, checking: true, error: undefined }));
      const res = await api.checkUsername(username.trim());
      if (res.data) {
        setUsernameStatus({
          checking: false,
          valid: res.data.valid,
          available: res.data.available,
          error: res.data.error,
        });
      } else {
        setUsernameStatus({
          checking: false,
          valid: false,
          available: false,
          error: res.error,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation checks
    if (!usernameStatus.valid || !usernameStatus.available) {
      setFormError('Please choose a valid and available username');
      return;
    }

    const filledPwd = password.filter((c) => c !== '').length;
    if (filledPwd !== 9) {
      setFormError('All 9 cells of the password matrix must be filled');
      return;
    }

    const filledConfirm = confirmPassword.filter((c) => c !== '').length;
    if (filledConfirm !== 9) {
      setFormError('All 9 cells of the confirmation matrix must be filled');
      return;
    }

    if (password.join('') !== confirmPassword.join('')) {
      setFormError('Passwords entered in the two matrices do not match');
      return;
    }

    if (!gender) {
      setFormError('Please select a gender option');
      return;
    }

    if (!acknowledgedPolicy) {
      setFormError('You must review and acknowledge the account permanence and 7-day deletion policy');
      return;
    }

    setIsLoading(true);

    try {
      // Generate or retrieve real ECDH identity public key for E2EE
      const { publicKeyBase64 } = await getOrCreateIdentityKeyPair();

      const res = await api.register({
        username: username.trim(),
        password,
        confirmPassword,
        gender,
        publicKey: publicKeyBase64,
      });

      if (res.error || !res.data) {
        setFormError(res.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      setRegisteredData({
        user: res.data.user,
        token: res.data.token,
      });
      setIsSuccessState(true);
    } catch (err: any) {
      setFormError(err.message || 'Registration error');
    } finally {
      setIsLoading(false);
    }
  };

  // Screen 2 Step 7: Account-Created Confirmation State
  if (isSuccessState && registeredData) {
    return (
      <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white border-2 border-neutral-900 shadow-sketch-lg text-center animate-fade-in text-neutral-900">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-neutral-100 border border-neutral-300 text-[11px] font-mono font-bold mb-2">
          IDENTITY VERIFIED ✦
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-1">
          Identity Initialized
        </h2>
        <p className="text-sm text-neutral-600 mb-6 font-mono font-bold">
          @{registeredData.user.username}
        </p>

        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs text-neutral-700 space-y-2.5 mb-5 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Gender Identity:</span>
            <span className="text-neutral-900 font-bold">{registeredData.user.gender}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Storage Policy:</span>
            <span className="text-neutral-900 font-bold bg-neutral-200 px-2 py-0.5 rounded">7-Day Zero-Archive</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">E2EE Cryptography:</span>
            <span className="text-neutral-900 font-bold">ECDH P-256 + AES-GCM</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-300 text-xs text-neutral-700 text-left mb-6 space-y-1">
          <p className="font-bold text-neutral-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-neutral-900" />
            <span>Permanent Credentials Notice</span>
          </p>
          <p className="text-neutral-500 text-[11px] leading-relaxed">
            Your username, 9-cell matrix password, and gender cannot be altered. Inactive accounts are permanently purged after 7 days.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSuccess(registeredData.user, registeredData.token)}
          className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <span>Enter SpillOut</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-white border border-neutral-300 shadow-panel space-y-5 text-neutral-900 transition-all"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-mono text-neutral-700 mb-2.5">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
          <span>No Email • No Phone • Zero Tracking</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-1">
          Create Account
        </h2>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Create your cryptographic identity. Everything is stored locally in device memory.
        </p>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-900 text-xs text-neutral-900 flex items-start gap-2.5 animate-fade-in font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-neutral-900" />
          <span>{formError}</span>
        </div>
      )}

      {/* Stage 1: Username */}
      <div>
        <label className="block text-xs uppercase tracking-wider font-semibold text-neutral-700 mb-1.5 font-sans">
          Choose Username
        </label>
        <div className="relative">
          <input
            type="text"
            maxLength={10}
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
            placeholder="Letters & digits only (max 10)"
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-300 focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 text-sm text-neutral-900 placeholder-neutral-400 font-mono transition"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="absolute right-3 top-3.5 flex items-center">
            {usernameStatus.checking ? (
              <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
            ) : usernameStatus.valid && usernameStatus.available ? (
              <span className="flex items-center gap-1 text-[11px] text-neutral-900 font-mono font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                <Check className="w-3 h-3 text-neutral-900" /> Available
              </span>
            ) : username && !usernameStatus.available ? (
              <span className="text-[11px] text-neutral-900 font-mono font-bold bg-neutral-200 px-2 py-0.5 rounded">
                Taken
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          3 to 10 alphanumeric characters. Case-insensitive.
        </p>
      </div>

      {/* Stage 2: Create Password Matrix */}
      <div>
        <MatrixPasswordInput
          value={password}
          onChange={setPassword}
          label="1. Create 3×3 Password Matrix"
          idPrefix="signup-pwd"
        />
      </div>

      {/* Stage 3: Confirm Password Matrix */}
      <div>
        <MatrixPasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          label="2. Confirm 3×3 Password Matrix"
          idPrefix="signup-confirm"
        />
      </div>

      {/* Stage 4: Gender Selection */}
      <div>
        <label className="block text-xs uppercase tracking-wider font-semibold text-neutral-700 mb-2 font-sans">
          Gender Selection
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['Male', 'Female', 'Object'] as Gender[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setGender(opt)}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold tracking-wide transition-all ${
                gender === opt
                  ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Permanent attribute. Cannot be altered once registered.
        </p>
      </div>

      {/* Stage 5: Account Restrictions and Privacy Notice */}
      <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-300 space-y-2.5 text-xs">
        <div className="flex items-start gap-2.5 text-neutral-800">
          <ShieldAlert className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] text-neutral-700 leading-relaxed">
            <p className="font-bold text-neutral-900">Permanent Credentials & 7-Day Expiration</p>
            <p className="text-neutral-500">
              • Forgotten passwords cannot be reset or recovered.
            </p>
            <p className="text-neutral-500">
              • Accounts inactive for 7 consecutive days are permanently deleted.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2.5 pt-1.5 cursor-pointer select-none border-t border-neutral-200">
          <input
            type="checkbox"
            checked={acknowledgedPolicy}
            onChange={(e) => setAcknowledgedPolicy(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-neutral-400 text-neutral-900 focus:ring-0 accent-neutral-900 cursor-pointer"
          />
          <span className="text-[11px] text-neutral-700 font-medium leading-tight">
            I understand my credentials are permanent and inactive accounts expire in 7 days.
          </span>
        </label>
      </div>

      {/* Stage 6: Submit Registration Form */}
      <button
        type="submit"
        disabled={isLoading || !usernameStatus.available || !acknowledgedPolicy}
        className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Establishing Cryptographic Identity...</span>
          </>
        ) : (
          <>
            <span>Complete Registration</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="text-center pt-1 border-t border-neutral-100">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-xs text-neutral-600 hover:text-neutral-900 transition font-sans"
        >
          Already have an account? <span className="font-bold underline text-neutral-900">Log in</span>
        </button>
      </div>
    </form>
  );
};
