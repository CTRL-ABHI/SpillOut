import { socket } from './socket';
import { sound } from './sound';
import { CallState } from '../types';

/**
 * Robust WebRTC Voice Call Manager for SPILLOUT
 * Peer-to-peer encrypted audio transport with DTLS-SRTP
 * Full candidate buffering, ring timeouts, DOM audio playback, and TURN support.
 */

export interface CallEvents {
  onStateChange: (state: CallState, error?: string) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onIncomingCall: (fromUsername: string, callId: string) => void;
}

function getRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  if (typeof window !== 'undefined') {
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  return { iceServers };
}

export class WebRTCVoiceManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private currentPeer: string | null = null;
  private currentState: CallState = 'idle';
  private events: CallEvents | null = null;
  private isMuted: boolean = false;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private ringTimeout: any = null;

  public init(events: CallEvents): () => void {
    this.events = events;

    this.ensureAudioElement();

    // Subscribe to WebSocket WebRTC signals
    const unsubscribeSignal = socket.on('webrtc-signal', async (payload: any) => {
      await this.handleSignal(payload);
    });

    const unsubscribeFailed = socket.on('call-failed', (payload: any) => {
      this.cleanup();
      this.setState('ended', payload?.reason || 'User is unavailable');
    });

    return () => {
      unsubscribeSignal();
      unsubscribeFailed();
      this.cleanup();
    };
  }

  private ensureAudioElement(): void {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('spillout-remote-audio') as HTMLAudioElement;
    if (!el) {
      el = document.createElement('audio');
      el.id = 'spillout-remote-audio';
      el.autoplay = true;
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.remoteAudioElement = el;
  }

  private setState(state: CallState, error?: string): void {
    this.currentState = state;
    if (this.events) {
      this.events.onStateChange(state, error);
    }
  }

  /**
   * Acquire local microphone stream with speech optimization filters
   */
  private async getMicrophone(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return this.localStream;
    } catch (err: any) {
      console.error('Microphone access denied or unavailable', err);
      throw new Error(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser.'
          : 'Microphone hardware error or unavailable.'
      );
    }
  }

  /**
   * Start an outgoing voice call with 45s ringing timeout
   */
  public async startCall(targetUsername: string): Promise<void> {
    this.cleanup();
    this.currentPeer = targetUsername;
    this.currentCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.setState('initiating');

    try {
      await this.getMicrophone();
      this.setState('ringing-outgoing');
      sound.startRingtone();

      socket.sendSignal(targetUsername, 'call-invite', {
        callId: this.currentCallId,
      });

      // 45-second unanswered call timeout
      this.ringTimeout = setTimeout(() => {
        if (this.currentState === 'ringing-outgoing') {
          sound.stopRingtone();
          sound.playCallEnd();
          this.endCall();
          this.setState('ended', 'No answer from recipient');
        }
      }, 45000);
    } catch (err: any) {
      this.cleanup();
      this.setState('ended', err.message);
    }
  }

  /**
   * Accept an incoming call
   */
  public async acceptCall(callerUsername: string, callId: string): Promise<void> {
    this.clearRingTimeout();
    sound.stopRingtone();
    this.currentPeer = callerUsername;
    this.currentCallId = callId;
    this.setState('connecting');

    try {
      const stream = await this.getMicrophone();
      this.setupPeerConnection();

      // Add local audio tracks to peer connection
      for (const track of stream.getAudioTracks()) {
        this.pc?.addTrack(track, stream);
      }

      socket.sendSignal(callerUsername, 'call-accept', {
        callId,
      });
    } catch (err: any) {
      this.cleanup();
      this.setState('ended', err.message);
    }
  }

  /**
   * Decline an incoming call
   */
  public declineCall(callerUsername: string, callId: string): void {
    this.clearRingTimeout();
    sound.stopRingtone();
    socket.sendSignal(callerUsername, 'call-decline', { callId });
    this.cleanup();
    this.setState('idle');
  }

  /**
   * End the current active call
   */
  public endCall(): void {
    this.clearRingTimeout();
    if (this.currentPeer && this.currentCallId) {
      socket.sendSignal(this.currentPeer, 'call-end', {
        callId: this.currentCallId,
      });
    }
    sound.playCallEnd();
    this.cleanup();
    this.setState('ended');
  }

  /**
   * Toggle microphone mute state
   */
  public toggleMute(): boolean {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.isMuted;
    }
    return this.isMuted;
  }

  private setupPeerConnection(): void {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
    }

    this.pendingCandidates = [];
    this.ensureAudioElement();

    const config = getRtcConfig();
    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.currentPeer && this.currentCallId) {
        socket.sendSignal(this.currentPeer, 'webrtc-ice', {
          callId: this.currentCallId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.play().catch((playErr) => {
            console.warn('Audio auto-play caught:', playErr);
          });
        }
        if (this.events) {
          this.events.onRemoteStream(remoteStream);
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      if (state === 'connected') {
        this.clearRingTimeout();
        sound.stopRingtone();
        this.setState('connected');
      } else if (state === 'failed') {
        this.clearRingTimeout();
        this.cleanup();
        this.setState('ended', 'Direct audio connection failed. Peer network may require TURN relay.');
      } else if (state === 'disconnected' || state === 'closed') {
        if (this.currentState === 'connected') {
          this.endCall();
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const iceState = this.pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        this.clearRingTimeout();
        sound.stopRingtone();
        this.setState('connected');
      } else if (iceState === 'failed') {
        this.clearRingTimeout();
        this.cleanup();
        this.setState('ended', 'ICE connectivity check failed.');
      }
    };
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;

    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Could not add queued ICE candidate', err);
        }
      }
    }
  }

  private async handleSignal(payload: any): Promise<void> {
    const { signalType, fromUsername, callId } = payload;

    switch (signalType) {
      case 'call-invite': {
        if (this.currentState !== 'idle') {
          // Busy with another call
          socket.sendSignal(fromUsername, 'call-busy', { callId });
          return;
        }
        this.currentPeer = fromUsername;
        this.currentCallId = callId;
        this.setState('ringing-incoming');
        sound.startRingtone();
        if (this.events) {
          this.events.onIncomingCall(fromUsername, callId);
        }
        break;
      }

      case 'call-accept': {
        if (this.currentState === 'ringing-outgoing' && this.currentPeer === fromUsername) {
          this.clearRingTimeout();
          sound.stopRingtone();
          this.setState('connecting');
          this.setupPeerConnection();

          const stream = await this.getMicrophone();
          for (const track of stream.getAudioTracks()) {
            this.pc?.addTrack(track, stream);
          }

          // Create offer as caller
          const offer = await this.pc!.createOffer({
            offerToReceiveAudio: true,
          });
          await this.pc!.setLocalDescription(offer);

          socket.sendSignal(fromUsername, 'webrtc-offer', {
            callId,
            sdp: offer,
          });
        }
        break;
      }

      case 'webrtc-offer': {
        if (payload.sdp) {
          if (!this.pc) {
            this.setupPeerConnection();
          }

          const activePc = this.pc;
          if (activePc) {
            const stream = await this.getMicrophone();
            for (const track of stream.getAudioTracks()) {
              activePc.addTrack(track, stream);
            }
          }

          await this.pc!.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this.drainPendingCandidates();

          const answer = await this.pc!.createAnswer();
          await this.pc!.setLocalDescription(answer);

          socket.sendSignal(fromUsername, 'webrtc-answer', {
            callId,
            sdp: answer,
          });
        }
        break;
      }

      case 'webrtc-answer': {
        if (this.pc && payload.sdp) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this.drainPendingCandidates();
        }
        break;
      }

      case 'webrtc-ice': {
        if (payload.candidate) {
          if (this.pc && this.pc.remoteDescription) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.warn('Could not add ICE candidate', err);
            }
          } else {
            // Buffer candidate until remote description is set
            this.pendingCandidates.push(payload.candidate);
          }
        }
        break;
      }

      case 'call-decline': {
        this.clearRingTimeout();
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'Call was declined by recipient');
        break;
      }

      case 'call-busy': {
        this.clearRingTimeout();
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'User is currently on another call');
        break;
      }

      case 'call-end': {
        this.clearRingTimeout();
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'Call ended by peer');
        break;
      }
    }
  }

  private clearRingTimeout(): void {
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }
  }

  public cleanup(): void {
    this.clearRingTimeout();
    sound.stopRingtone();
    this.pendingCandidates = [];

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      this.localStream = null;
    }

    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    this.currentCallId = null;
    this.currentPeer = null;
    this.isMuted = false;
  }
}

export const webrtcVoice = new WebRTCVoiceManager();
