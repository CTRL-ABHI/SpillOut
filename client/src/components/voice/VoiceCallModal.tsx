'use client';

import React, { useState, useEffect } from 'react';
import { CallState } from '@/types';
import { webrtcVoice } from '@/lib/webrtc';
import { DoodleAvatar } from '../doodles/avatars/DoodleAvatar';
import { Phone, PhoneOff, Mic, MicOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { VoiceWaveDoodle } from '../doodles/VoiceWaveDoodle';

interface VoiceCallModalProps {
  peerUsername: string;
  peerAvatarId?: string | null;
  callState: CallState;
  isIncoming: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onEndCall: () => void;
  errorMessage?: string;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  peerUsername,
  peerAvatarId,
  callState,
  isIncoming,
  onAccept,
  onDecline,
  onEndCall,
  errorMessage,
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Call duration timer
  useEffect(() => {
    let timer: any = null;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  if (callState === 'idle') return null;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const muted = webrtcVoice.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none text-neutral-900">
      <div className="w-full max-w-sm p-6 sm:p-8 rounded-3xl bg-white border border-neutral-300 shadow-modal text-center space-y-5 animate-pop-in">
        {/* Peer Avatar & Concentric Hand-drawn Pulse */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          {callState === 'connected' && (
            <div className="absolute inset-0 rounded-full border-2 border-neutral-300 animate-ping opacity-40" />
          )}
          {(callState === 'ringing-outgoing' || callState === 'ringing-incoming') && (
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-neutral-400 animate-spin opacity-50" />
          )}

          <div className="z-10 shadow-md rounded-full">
            <DoodleAvatar
              avatarId={peerAvatarId}
              username={peerUsername}
              size="xl"
            />
          </div>
        </div>

        {/* Identity & Status */}
        <div>
          <h3 className="text-xl font-extrabold text-neutral-900 font-mono">
            @{peerUsername}
          </h3>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            {callState === 'initiating' && 'Initiating WebRTC handshake...'}
            {callState === 'ringing-outgoing' && 'Ringing...'}
            {callState === 'ringing-incoming' && 'Incoming Encrypted Voice Call...'}
            {callState === 'connecting' && 'Connecting audio stream...'}
            {callState === 'connected' && (
              <span className="text-neutral-900 font-bold bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-300">
                Connected • {formatDuration(duration)}
              </span>
            )}
            {callState === 'ended' && 'Call Terminated'}
          </p>

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-700">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
            <span>DTLS-SRTP Audio Encryption</span>
          </div>
        </div>

        {/* Soundwave Line-art Doodle */}
        <VoiceWaveDoodle active={callState === 'connected'} />

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-900 text-xs text-neutral-900 flex items-start gap-2 text-left font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Call Controls */}
        <div className="pt-2 flex items-center justify-center gap-4">
          {/* Incoming Call Buttons */}
          {callState === 'ringing-incoming' && (
            <>
              <button
                type="button"
                onClick={onDecline}
                className="w-13 h-13 p-3.5 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-900 flex items-center justify-center shadow-sm transition active:scale-95 border border-neutral-300"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={onAccept}
                className="w-13 h-13 p-3.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center shadow-md transition active:scale-95"
                title="Accept Call"
              >
                <Phone className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Connected or Outgoing Controls */}
          {callState !== 'ringing-incoming' && callState !== 'ended' && (
            <>
              <button
                type="button"
                onClick={handleToggleMute}
                className={`w-12 h-12 rounded-full border flex items-center justify-center transition active:scale-95 ${
                  isMuted
                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                    : 'bg-neutral-100 border-neutral-300 hover:bg-neutral-200 text-neutral-800'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={onEndCall}
                className="w-12 h-12 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center shadow-md transition active:scale-95"
                title="End Voice Call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Ended State Dismiss */}
          {callState === 'ended' && (
            <button
              type="button"
              onClick={onEndCall}
              className="py-2.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-sm"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
