import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';

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

// ICE servers for STUN/TURN
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useCalls(conversationId: string | null) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const signalChannel = useRef<RealtimeChannel | null>(null);
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);
  const pendingIceCandidates = useRef<RTCIceCandidate[]>([]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (signalChannel.current) {
      supabase.removeChannel(signalChannel.current);
      signalChannel.current = null;
    }
    pendingIceCandidates.current = [];
    setRemoteStreams(new Map());
    setConnectionStatus('disconnected');
  }, [localStream]);

  // Fetch active call for conversation
  const fetchActiveCall = useCallback(async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active call:', error);
      setActiveCall(null);
      setParticipants([]);
      setIsRecording(false);
      return;
    }

    if (data) {
      // Cleanup duplicate calls
      if (user) {
        await supabase
          .from('calls')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('is_active', true)
          .eq('started_by', user.id)
          .neq('id', data.id);
      }

      setActiveCall(data as Call);
      setIsRecording(data.is_recording);
      await fetchParticipants(data.id);
      return;
    }

    setActiveCall(null);
    setParticipants([]);
    setIsRecording(false);
  }, [conversationId, user]);

  // Fetch call participants
  const fetchParticipants = async (callId: string) => {
    const { data: participantsData } = await supabase
      .from('call_participants')
      .select('*')
      .eq('call_id', callId)
      .is('left_at', null);

    if (participantsData) {
      // Auto-end call if no participants for too long
      if (participantsData.length === 0) {
        await supabase
          .from('calls')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('id', callId)
          .eq('is_active', true);
        setActiveCall(null);
        setParticipants([]);
        return;
      }

      const userIds = participantsData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);

      const participantsWithProfiles = participantsData.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.user_id === p.user_id)
      })) as CallParticipant[];

      setParticipants(participantsWithProfiles);

      if (user) {
        const userInCall = participantsData.some(p => p.user_id === user.id);
        setIsInCall(userInCall);
      }
    }
  };

  // Start a new call
  const startCall = async (callType: 'voice' | 'video' = 'video'): Promise<string | null> => {
    if (!user || !conversationId) return null;

    // Check for existing active call
    const { data: existing } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const existingType: 'voice' | 'video' = existing.call_type === 'voice' ? 'voice' : 'video';
      await joinCall(existing.id, existingType);
      return existing.id;
    }

    // Cleanup old calls
    await supabase
      .from('calls')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .eq('started_by', user.id);

    const { data, error } = await supabase
      .from('calls')
      .insert({
        conversation_id: conversationId,
        started_by: user.id,
        call_type: callType
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting call:', error);
      return null;
    }

    await joinCall(data.id, callType, true);
    return data.id;
  };

  // Join an existing call
  const joinCall = async (callId: string, callType: 'voice' | 'video' = 'video', isCreator: boolean = false) => {
    if (!user) return;

    setConnectionStatus('connecting');

    try {
      // Get local media stream
      const constraints = {
        audio: true,
        video: callType === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsVideoOff(callType === 'voice');

      // Create peer connection
      const pc = new RTCPeerConnection(servers);
      peerConnection.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Remote track received:', event.streams);
        const [remoteStream] = event.streams;
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set('remote', remoteStream);
          return newMap;
        });
        setConnectionStatus('connected');
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setConnectionStatus('connected');
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setConnectionStatus('disconnected');
        }
      };

      // ICE candidate handler - send to Supabase
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate');
          await supabase.from('call_signals').insert([{
            call_id: callId,
            from_user: user.id,
            signal_type: 'ice-candidate',
            signal_data: JSON.parse(JSON.stringify(event.candidate.toJSON())) as Json
          }]);
        }
      };

      // Subscribe to Supabase Realtime for signaling
      signalChannel.current = supabase
        .channel(`call-signals-${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_signals',
            filter: `call_id=eq.${callId}`
          },
          async (payload) => {
            const signal = payload.new as {
              from_user: string;
              signal_type: string;
              signal_data: RTCSessionDescriptionInit | RTCIceCandidateInit;
            };

            // Ignore our own signals
            if (signal.from_user === user.id) return;

            console.log('Received signal:', signal.signal_type);

            if (signal.signal_type === 'offer' && !isCreator) {
              // We're the joiner receiving an offer
              const offerDescription = signal.signal_data as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

              // Add any pending ICE candidates
              for (const candidate of pendingIceCandidates.current) {
                await pc.addIceCandidate(candidate);
              }
              pendingIceCandidates.current = [];

              // Create and send answer
              const answerDescription = await pc.createAnswer();
              await pc.setLocalDescription(answerDescription);

              await supabase.from('call_signals').insert([{
                call_id: callId,
                from_user: user.id,
                signal_type: 'answer',
                signal_data: {
                  sdp: answerDescription.sdp,
                  type: answerDescription.type
                } as Json
              }]);
            } else if (signal.signal_type === 'answer' && isCreator) {
              // We're the creator receiving an answer
              const answerDescription = signal.signal_data as RTCSessionDescriptionInit;
              if (!pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(answerDescription));

                // Add any pending ICE candidates
                for (const candidate of pendingIceCandidates.current) {
                  await pc.addIceCandidate(candidate);
                }
                pendingIceCandidates.current = [];
              }
            } else if (signal.signal_type === 'ice-candidate') {
              // ICE candidate
              const candidateInit = signal.signal_data as RTCIceCandidateInit;
              const candidate = new RTCIceCandidate(candidateInit);

              if (pc.remoteDescription) {
                await pc.addIceCandidate(candidate);
              } else {
                // Queue candidate until remote description is set
                pendingIceCandidates.current.push(candidate);
              }
            }
          }
        )
        .subscribe();

      if (isCreator) {
        // Creator: create and send offer
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        await supabase.from('call_signals').insert([{
          call_id: callId,
          from_user: user.id,
          signal_type: 'offer',
          signal_data: {
            sdp: offerDescription.sdp,
            type: offerDescription.type
          } as Json
        }]);
      } else {
        // Joiner: check for existing offer
        const { data: existingOffer } = await supabase
          .from('call_signals')
          .select('*')
          .eq('call_id', callId)
          .eq('signal_type', 'offer')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingOffer) {
          const offerDescription = existingOffer.signal_data as unknown as RTCSessionDescriptionInit;
          await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

          // Fetch and add existing ICE candidates
          const { data: existingCandidates } = await supabase
            .from('call_signals')
            .select('*')
            .eq('call_id', callId)
            .eq('signal_type', 'ice-candidate')
            .neq('from_user', user.id);

          if (existingCandidates) {
            for (const candidateSignal of existingCandidates) {
              const candidate = new RTCIceCandidate(candidateSignal.signal_data as unknown as RTCIceCandidateInit);
              await pc.addIceCandidate(candidate);
            }
          }

          // Create and send answer
          const answerDescription = await pc.createAnswer();
          await pc.setLocalDescription(answerDescription);

          await supabase.from('call_signals').insert([{
            call_id: callId,
            from_user: user.id,
            signal_type: 'answer',
            signal_data: {
              sdp: answerDescription.sdp,
              type: answerDescription.type
            } as Json
          }]);
        }
      }

      // Add participant to database
      const { data: existingParticipant } = await supabase
        .from('call_participants')
        .select('id')
        .eq('call_id', callId)
        .eq('user_id', user.id)
        .is('left_at', null)
        .limit(1)
        .maybeSingle();

      if (existingParticipant?.id) {
        await supabase
          .from('call_participants')
          .update({ is_video_off: callType === 'voice' })
          .eq('id', existingParticipant.id);
      } else {
        await supabase
          .from('call_participants')
          .insert({
            call_id: callId,
            user_id: user.id,
            is_video_off: callType === 'voice'
          });
      }

      setIsInCall(true);
      await fetchActiveCall();

    } catch (error) {
      console.error('Error joining call:', error);
      cleanup();
      toast.error('Failed to join call. Please check your camera/microphone permissions.');
    }
  };

  // Leave the call
  const leaveCall = async () => {
    if (!user || !activeCall) return;

    // Stop recording if we started it
    if (activeCall.is_recording && activeCall.recorded_by === user.id) {
      await stopRecording();
    }

    cleanup();

    // Update database
    await supabase
      .from('call_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id);

    // Check if any participants remain - if not, end the call
    const { data: remainingParticipants } = await supabase
      .from('call_participants')
      .select('id')
      .eq('call_id', activeCall.id)
      .is('left_at', null);

    if (!remainingParticipants || remainingParticipants.length === 0) {
      // End the call immediately if no participants remain
      await supabase
        .from('calls')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeCall.id);

      // Clean up old signals for this call
      await supabase
        .from('call_signals')
        .delete()
        .eq('call_id', activeCall.id);
    }

    setIsInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    await fetchActiveCall();
  };

  // End call (only call starter)
  const endCall = async () => {
    if (!user || !activeCall) return;

    // Stop recording first
    if (activeCall.is_recording && activeCall.recorded_by === user.id) {
      await stopRecording();
    }

    await supabase
      .from('calls')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', activeCall.id);

    // Clean up signals for this call
    await supabase
      .from('call_signals')
      .delete()
      .eq('call_id', activeCall.id);

    await leaveCall();
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeCall || !localStream) return;

    try {
      recordedChunks.current = [];

      const preferredMimeType = 'audio/webm;codecs=opus';
      let recorder: MediaRecorder;

      if (MediaRecorder.isTypeSupported(preferredMimeType)) {
        recorder = new MediaRecorder(localStream, { mimeType: preferredMimeType });
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm' });
      } else {
        recorder = new MediaRecorder(localStream);
      }

      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      recorder.start(1000);

      await supabase
        .from('calls')
        .update({
          is_recording: true,
          recording_title: title,
          recorded_by: user.id,
        })
        .eq('id', activeCall.id);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!user || !activeCall) return;
    if (activeCall.recorded_by && activeCall.recorded_by !== user.id) return;

    const recordingTitle = activeCall.recording_title || 'Call Recording';
    const recorder = mediaRecorder.current;

    try {
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = async () => {
            try {
              if (recordedChunks.current.length > 0) {
                const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
                await saveRecording(blob, recordingTitle);
              }
            } finally {
              resolve();
            }
          };
          recorder.stop();
        });
      }
    } finally {
      mediaRecorder.current = null;
      recordedChunks.current = [];

      await supabase
        .from('calls')
        .update({ is_recording: false })
        .eq('id', activeCall.id);

      setIsRecording(false);
    }
  };

  // Save recording
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) return;

    toast.loading('Saving recording...', { id: 'save-call-recording' });

    try {
      const fileName = `recording_${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        toast.error('Failed to upload recording', { id: 'save-call-recording' });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const { data: convData } = await supabase.functions.invoke('create-conversation', {
        body: { type: 'saved' }
      });

      if (!convData?.id) {
        toast.error('Could not find Saved Messages', { id: 'save-call-recording' });
        return;
      }

      const displayTitle = (title || 'Call Recording').trim() || 'Call Recording';

      await supabase
        .from('messages')
        .insert({
          conversation_id: convData.id,
          sender_id: user.id,
          content: displayTitle,
          message_type: 'file',
          file_url: publicUrl,
          file_name: `${displayTitle}.webm`,
          file_size: blob.size,
        });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convData.id);

      toast.success('Recording saved to Saved Messages', { id: 'save-call-recording' });
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording', { id: 'save-call-recording' });
    }
  };

  // Toggle mute
  const toggleMute = async () => {
    if (!user || !activeCall || !localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);

      await supabase
        .from('call_participants')
        .update({ is_muted: !audioTrack.enabled })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (!user || !activeCall || !localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);

      await supabase
        .from('call_participants')
        .update({ is_video_off: !videoTrack.enabled })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (!user || !activeCall || !localStream || !peerConnection.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing, restore camera
        if (originalVideoTrack.current) {
          const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(originalVideoTrack.current);
          }
          // Update local stream
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
          }
          localStream.addTrack(originalVideoTrack.current);
          originalVideoTrack.current = null;
        }
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Save original video track
        const currentVideoTrack = localStream.getVideoTracks()[0];
        if (currentVideoTrack) {
          originalVideoTrack.current = currentVideoTrack.clone();
        }

        // Replace track in peer connection
        const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        // Update local stream
        if (currentVideoTrack) {
          localStream.removeTrack(currentVideoTrack);
        }
        localStream.addTrack(screenTrack);

        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      if ((error as Error).name !== 'NotAllowedError') {
        toast.error('Failed to share screen');
      }
    }
  };

  // Subscribe to call changes
  useEffect(() => {
    if (!conversationId) return;

    fetchActiveCall();

    const channel = supabase
      .channel(`calls-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `conversation_id=eq.${conversationId}` },
        () => fetchActiveCall()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_participants' },
        () => {
          if (activeCall) {
            fetchParticipants(activeCall.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchActiveCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  return {
    activeCall,
    participants,
    isInCall,
    localStream,
    remoteStreams,
    isRecording,
    connectionStatus,
    isMuted,
    isVideoOff,
    isScreenSharing,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    startRecording,
    stopRecording
  };
}
