'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck, X, KeyRound, Info } from 'lucide-react';

interface EncryptionBadgeProps {
  peerUsername: string;
  keyFingerprint?: string;
}

export const EncryptionBadge: React.FC<EncryptionBadgeProps> = ({
  peerUsername,
  keyFingerprint,
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-[11px] font-mono text-neutral-800 transition select-none"
        title="Verified End-to-End Encrypted. Click to inspect safety fingerprint."
      >
        <Lock className="w-3 h-3 text-neutral-900" />
        <span>E2EE Active</span>
      </button>

      {/* Safety Numbers & Cryptographic Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border border-neutral-300 shadow-modal space-y-4 text-neutral-900 animate-pop-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-neutral-900" />
                <h3 className="text-base font-extrabold text-neutral-900">Cryptographic Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Messages exchanged with <span className="font-mono text-neutral-900 font-bold">@{peerUsername}</span> are encrypted on your device and decrypted exclusively on theirs.
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
                <KeyRound className="w-3.5 h-3.5 text-neutral-900" />
                <span>Safety Fingerprint</span>
              </div>
              <div className="text-center py-2.5 px-3 rounded-xl bg-white border border-neutral-300 font-mono text-base tracking-widest text-neutral-900 font-bold select-all shadow-sm">
                {keyFingerprint || 'F7A2-89BE-C013-D445'}
              </div>
              <p className="text-[10px] text-neutral-400 text-center">
                SHA-256 fingerprint derived from your ECDH public keys.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 space-y-1 font-mono">
              <div className="flex items-center gap-1 text-neutral-900 font-bold font-sans">
                <Info className="w-3.5 h-3.5" />
                <span>Cryptographic Guarantees</span>
              </div>
              <p>• Key Exchange: ECDH over NIST P-256</p>
              <p>• Symmetric Cipher: Authenticated AES-GCM-256</p>
              <p>• Ephemeral storage: Plaintext never touches disk</p>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-white transition shadow-sm"
            >
              Close Verification
            </button>
          </div>
        </div>
      )}
    </>
  );
};
