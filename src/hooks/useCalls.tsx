import { useLiveStream } from './useLiveStream';

export interface Call {
  id: string;
  conversation_id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  call_type: 'voice' | 'video';
  is_active: boolean;
  is_recording: boolean;
  recording_title: string | null;
  recording_url: string | null;
  recorded_by: string | null;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  is_video_off: boolean;
  hand_raised?: boolean;
  noise_suppression?: boolean;
  profile?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface RemoteStream {
  oderId: string;
  stream: MediaStream;
}

export function useCalls(conversationId: string | null) {
  // Direct voice calls and rooms share one targeted signaling/lifecycle engine.
  const room = useLiveStream(conversationId, true);
  return {
    activeCall: room.activeStream, participants: room.participants, isInCall: room.isInStream,
    localStream: room.localStream, remoteStreams: room.remoteStreams, isRecording: room.isRecording,
    connectionStatus: room.connectionStatus, isMuted: room.isMuted, isVideoOff: true, isScreenSharing: false,
    startCall: async (_type: 'voice' | 'video' = 'voice') => room.startStream('Voice call'),
    joinCall: async (id: string, _type: 'voice' | 'video' = 'voice', _creator = false) => room.joinStream(id, false),
    leaveCall: room.leaveStream, endCall: room.endStream, toggleMute: room.toggleMute,
    toggleVideo: async () => {}, toggleScreenShare: async () => {},
    startRecording: room.startRecording, stopRecording: room.stopRecording,
  };
}
