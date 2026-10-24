'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/branding/Logo';
import { DoodleWallpaper } from '@/components/doodles/DoodleWallpaper';
import {
  ShieldCheck,
  Lock,
  Trash2,
  KeyRound,
  EyeOff,
  UserX,
  ArrowLeft,
  AlertTriangle,
  ServerOff,
  PhoneCall,
  Sparkles,
} from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-neutral-900 p-4 sm:p-8 flex justify-center relative overflow-x-hidden">
      <DoodleWallpaper opacity={0.035} />

      <div className="w-full max-w-3xl space-y-8 py-6 relative z-10">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold text-neutral-600 hover:text-neutral-900 transition bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full border border-neutral-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to SpillOut</span>
          </Link>
          <Logo size="sm" showSubtitle={false} />
        </div>

        {/* Title and Introduction */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-300 text-xs font-mono font-bold text-neutral-800 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cryptographic Architecture & Threat Model</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">
            Privacy enforced by mathematics, not marketing.
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl">
            SpillOut enforces privacy through native cryptographic code and memory-only architectures.
            Below is the comprehensive, transparent specification of our cryptographic guarantees, data handling, and threat model.
          </p>
        </div>

        {/* Section 1: End-to-End Encryption */}
        <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Genuine End-to-End Encryption (E2EE)
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                ECDH P-256 • HKDF-SHA256 • AES-GCM-256
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            All text messages are encrypted directly inside your browser using the native Web Crypto API prior to transmission over the network.
            The server functions strictly as an opaque message relay for ciphertext, initialization vectors, and authentication tags.
            Backend systems cannot decrypt, inspect, or tamper with message plaintext.
          </p>
        </div>

        {/* Section 2: Ephemeral Zero-Archive Storage */}
        <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <ServerOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Zero-Archive Ephemeral Messaging
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                No Messages Table • No Disk Caching • No Offline Queuing
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            SpillOut has no messages table in its database schema. Message payloads are never written to PostgreSQL, Redis snapshots, server logs, or persistent disk.
            Messages can only be exchanged when both users are actively online. Once you refresh your browser, close the tab, or log out, conversation plaintext is permanently purged from memory and cannot be recovered.
          </p>
        </div>

        {/* Section 3: 7-Day Inactivity Deletion */}
        <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Automatic 7-Day Inactivity Deletion
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Server-enforced `lastActivityAt` • Complete Eviction
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Every account is assigned a server-controlled qualifying activity timestamp. Meaningful actions (logging in, sending encrypted messages, starting voice calls) refresh this timestamp.
            Background WebSocket pings do not prolong account life. If an account is inactive for 7 consecutive days, our automated backend cleanup job permanently and irreversibly deletes the user account, sessions, and public key metadata.
            Once deleted, the username becomes available for anyone to claim anew.
          </p>
        </div>

        {/* Section 4: Encrypted Voice Calls */}
        <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                DTLS-SRTP Voice Media Transport
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Peer-to-Peer WebRTC • Zero Recording • Zero Transcripts
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Voice calls establish direct peer-to-peer WebRTC connections protected by DTLS-SRTP encryption.
            No call audio is routed through, recorded by, or decrypted by our backend servers.
            There are zero call recording mechanisms, automated transcripts, or audio archiving features.
          </p>
        </div>

        {/* Section 5: Minimal Identity Retention */}
        <div className="p-6 rounded-3xl bg-white border border-neutral-300 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                No Real-Name, Email, or Phone Collection
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Argon2id Salted Hashes • No Trackers • No Third Parties
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            You do not need a Google account, email address, or phone number to register.
            We store only:
            (1) Your chosen username (max 10 characters),
            (2) Your Argon2id password hash,
            (3) Your immutable gender selection,
            (4) Account creation & last activity timestamps,
            (5) Your public ECDH identity key.
            We do not embed third-party analytics, tracking pixels, or advertising SDKs.
          </p>
        </div>

        {/* Section 6: Honest Limitations & Threat Model */}
        <div className="p-6 rounded-3xl bg-neutral-50 border-2 border-neutral-900 shadow-sketch-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-neutral-900" />
            <h2 className="text-base font-extrabold text-neutral-900">
              Practical Security & Anonymity Limitations
            </h2>
          </div>
          <div className="space-y-2 text-xs text-neutral-600 leading-relaxed">
            <p>
              • <strong className="text-neutral-900">Screenshot Deterrents:</strong> While SpillOut provides an anti-casual-capture Screen Shield that obscures content when switching windows, no browser application can physically stop an operating system screen grab, HDMI recorder, or external camera photographing the physical display.
            </p>
            <p>
              • <strong className="text-neutral-900">No Credential Recovery:</strong> Because we never collect emails or phone numbers, forgotten passwords cannot be recovered or reset. Ensure you remember your 3×3 matrix sequence.
            </p>
            <p>
              • <strong className="text-neutral-900">Network Metadata:</strong> Standard internet communication involves routing IP addresses between network peers and servers. True anonymity requires routing through Tor or a reputable VPN.
            </p>
          </div>
        </div>

        {/* Return Button */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-block py-3 px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-sm active:scale-95"
          >
            Acknowledge & Return to App
          </Link>
        </div>
      </div>
    </div>
  );
}
