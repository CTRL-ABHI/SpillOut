import { socket } from './socket';
import { sound } from './sound';
import { CallState } from '../types';

/**
 * WebRTC Voice Call Manager for SPILLOUT
 * Peer-to-peer audio transport with mandatory DTLS-SRTP encryption
 */

export interface CallEvents {
  onStateChange: (state: CallState, error?: string) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onIncomingCall: (fromUsername: string, callId: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCVoiceManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private currentPeer: string | null = null;
  private currentState: CallState = 'idle';
  private events: CallEvents | null = null;
  private isMuted: boolean = false;
  private remoteAudioElement: HTMLAudioElement | null = null;

  public init(events: CallEvents): () => void {
    this.events = events;

    if (typeof window !== 'undefined') {
      this.remoteAudioElement = document.createElement('audio');
      this.remoteAudioElement.autoplay = true;
    }

    // Subscribe to WebSocket WebRTC signals
    const unsubscribe = socket.on('webrtc-signal', async (payload: any) => {
      await this.handleSignal(payload);
    });

    const unsubscribeUndelivered = socket.on('call-failed', (payload: any) => {
      this.cleanup();
      this.setState('ended', payload?.reason || 'Call failed');
    });

    return () => {
      unsubscribe();
      unsubscribeUndelivered();
      this.cleanup();
    };
  }

  private setState(state: CallState, error?: string): void {
    this.currentState = state;
    if (this.events) {
      this.events.onStateChange(state, error);
    }
  }

  /**
   * Acquire local microphone stream
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
          ? 'Microphone permission denied. Please allow microphone access in browser settings.'
          : 'Microphone hardware error.'
      );
    }
  }

  /**
   * Start an outgoing call
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
    } catch (err: any) {
      this.cleanup();
      this.setState('ended', err.message);
    }
  }

  /**
   * Accept an incoming call
   */
  public async acceptCall(callerUsername: string, callId: string): Promise<void> {
    sound.stopRingtone();
    this.currentPeer = callerUsername;
    this.currentCallId = callId;
    this.setState('connecting');

    try {
      const stream = await this.getMicrophone();
      this.setupPeerConnection();

      // Add audio tracks to peer connection
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
    sound.stopRingtone();
    socket.sendSignal(callerUsername, 'call-decline', { callId });
    this.cleanup();
    this.setState('idle');
  }

  /**
   * End the current active call
   */
  public endCall(): void {
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
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.currentPeer && this.currentCallId) {
        socket.sendSignal(this.currentPeer, 'webrtc-ice', {
          callId: this.currentCallId,
          candidate: event.candidate,
        });
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.play().catch(() => {});
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
        sound.stopRingtone();
        this.setState('connected');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (this.currentState === 'connected') {
          this.endCall();
        }
      }
    };
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
          sound.stopRingtone();
          this.setState('connecting');
          this.setupPeerConnection();

          const stream = await this.getMicrophone();
          for (const track of stream.getAudioTracks()) {
            this.pc?.addTrack(track, stream);
          }

          // Create offer as the caller
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
        if (this.pc && payload.sdp) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);

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
        }
        break;
      }

      case 'webrtc-ice': {
        if (this.pc && payload.candidate) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.warn('Could not add ICE candidate', err);
          }
        }
        break;
      }

      case 'call-decline': {
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'Call was declined by recipient');
        break;
      }

      case 'call-busy': {
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'User is currently on another call');
        break;
      }

      case 'call-end': {
        sound.stopRingtone();
        sound.playCallEnd();
        this.cleanup();
        this.setState('ended', 'Call ended by peer');
        break;
      }
    }
  }

  public cleanup(): void {
    sound.stopRingtone();
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
