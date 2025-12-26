import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CallParticipant } from './useCalls';
import { toast } from 'sonner';

export interface LiveStream {
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
  livestream_title: string | null;
}

export function useLiveStream(conversationId: string | null) {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInStream, setIsInStream] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Non-admins start muted
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const signalingChannel = useRef<any>(null);

  const cleanup = useCallback(() => {
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }
  }, [localStream]);

  // Fetch active stream
  const fetchActiveStream = useCallback(async () => {
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
      console.error('Error fetching active stream:', error);
      setActiveStream(null);
      setParticipants([]);
      setIsRecording(false);
      return;
    }

    if (data) {
      // If the current user accidentally started multiple streams, close the older ones.
      if (user) {
        const { error: cleanupError } = await supabase
          .from('calls')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('is_active', true)
          .eq('started_by', user.id)
          .neq('id', data.id);

        if (cleanupError) {
          console.warn('Failed to cleanup duplicate streams:', cleanupError);
        }
      }

      setActiveStream(data as LiveStream);
      setIsRecording(data.is_recording);
      await fetchParticipants(data.id);
      return;
    }

    setActiveStream(null);
    setParticipants([]);
    setIsRecording(false);
  }, [conversationId, user]);

  // ICE servers for STUN/STUN
  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const getOrCreatePC = useCallback((remoteUserId: string, stream: MediaStream, callId: string) => {
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId)!;
    }

    console.log(`📡 Creating PeerConnection for user: ${remoteUserId}`);
    const pc = new RTCPeerConnection(servers);
    peerConnections.current.set(remoteUserId, pc);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote track
    pc.ontrack = (event) => {
      console.log(`🎵 Remote track received from ${remoteUserId}:`, event.track.kind);
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(remoteUserId, remoteStream);
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        await supabase.from('call_signals').insert({
          call_id: callId,
          from_user: user.id,
          to_user: remoteUserId,
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as any
        });
      }
    };

    return pc;
  }, [user]);

  // Fetch participants
  const fetchParticipants = async (callId: string) => {
    const { data: participantsData } = await supabase
      .from('call_participants')
      .select('*')
      .eq('call_id', callId)
      .is('left_at', null);

    if (participantsData) {
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
        const currentParticipant = participantsData.find(p => p.user_id === user.id);
        setIsInStream(!!currentParticipant);
        if (currentParticipant) {
          setHandRaised(currentParticipant.hand_raised || false);
          setIsMuted(currentParticipant.is_muted);
          setNoiseSuppression(currentParticipant.noise_suppression ?? true);
        }
      }
    }
  };

  // Start a new live stream
  const startStream = async (title: string = 'Live Stream'): Promise<string | null> => {
    if (!user || !conversationId) {
      console.log('Cannot start stream: missing user or conversationId');
      return null;
    }

    // If a stream is already active for this channel, just join it.
    const { data: existing, error: existingError } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) {
      console.log('Stream already active, joining instead of creating:', existing.id);
      await joinStream(existing.id, false);
      return existing.id;
    }

    // Cleanup any other active streams started by this same user (prevents duplicates).
    await supabase
      .from('calls')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .eq('started_by', user.id);

    console.log('Starting live stream...', { conversationId, title });

    const { data, error } = await supabase
      .from('calls')
      .insert({
        conversation_id: conversationId,
        started_by: user.id,
        call_type: 'voice',
        livestream_title: title
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting stream:', error);
      return null;
    }

    console.log('Stream created:', data);

    // Send a system message to notify channel members
    try {
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: `🔴 Live Stream Started: "${title}"`,
          message_type: 'text'
        });
      if (msgErr) console.error('🔴 System message failed (400?):', msgErr);
    } catch (err) {
      console.error('🔴 System message exception:', err);
    }

    // Join the stream immediately
    await joinStream(data.id, false); // Admin starts unmuted
    return data.id;
  };

  // Join stream
  const joinStream = async (callId: string, startMuted: boolean = true) => {
    if (!user) {
      console.log('Cannot join stream: no user');
      return;
    }

    console.log('Joining stream...', { callId, startMuted });

    try {
      // Refresh current participants to know who to connect to
      const { data: participantsData } = await supabase
        .from('call_participants')
        .select('user_id')
        .eq('call_id', callId)
        .is('left_at', null);

      const otherUserIds = participantsData?.map(p => p.user_id).filter(id => id !== user.id) || [];

      // Request audio permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseSuppression,
          autoGainControl: true
        }
      });

      console.log('Got audio stream');

      // Mute by default for non-admins
      stream.getAudioTracks().forEach(track => {
        track.enabled = !startMuted;
      });

      setLocalStream(stream);
      setIsMuted(startMuted);

      // CRITICAL: Ensure the user has only one active participant row per call - check for ANY existing row
      // We do this BEFORE any signaling starts so that RLS doesn't block OUR signals.
      const { data: existingParticipant } = await supabase
        .from('call_participants')
        .select('id')
        .eq('call_id', callId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (existingParticipant?.id) {
        console.log('Re-joining stream: Updating existing participant record before signaling');
        await supabase
          .from('call_participants')
          .update({
            is_muted: startMuted,
            is_video_off: true,
            hand_raised: false,
            noise_suppression: noiseSuppression,
            left_at: null // Clear left_at
          })
          .eq('id', existingParticipant.id);
      } else {
        console.log('Joining stream: Creating new participant record before signaling');
        await supabase
          .from('call_participants')
          .insert({
            call_id: callId,
            user_id: user.id,
            is_muted: startMuted,
            is_video_off: true,
            hand_raised: false,
            noise_suppression: noiseSuppression,
            left_at: null
          });
      }

      setIsInStream(true);
      await fetchActiveStream();

      // Setup signaling channel
      const channel = supabase
        .channel(`livestream-signal-${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_signals',
            filter: `call_id=eq.${callId}`
          },
          async (payload: any) => {
            const signal = payload.new;
            if (signal.from_user === user.id) return;
            // If the signal is targeted at someone else, ignore it (unless it's a broadcast)
            if (signal.to_user && signal.to_user !== user.id) return;

            console.log(`📥 Received signal ${signal.signal_type} from ${signal.from_user}`);

            const pc = getOrCreatePC(signal.from_user, stream, callId);

            try {
              if (signal.signal_type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await supabase.from('call_signals').insert({
                  call_id: callId,
                  from_user: user.id,
                  to_user: signal.from_user,
                  signal_type: 'answer',
                  signal_data: answer as any
                });
              } else if (signal.signal_type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
              } else if (signal.signal_type === 'ice-candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data));
              }
            } catch (err) {
              console.error('Error handling signal:', err);
            }
          }
        )
        .subscribe();

      signalingChannel.current = channel;

      // Initiate connections to existing participants
      for (const remoteUserId of otherUserIds) {
        const pc = getOrCreatePC(remoteUserId, stream, callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await supabase.from('call_signals').insert({
          call_id: callId,
          from_user: user.id,
          to_user: remoteUserId,
          signal_type: 'offer',
          signal_data: offer as any
        });
      }

      console.log('Join process completed successfully');
      console.log('Stream joined successfully with WebRTC signaling');
    } catch (error) {
      console.error('Error joining stream:', error);
      // Re-throw the error
      throw error;
    }
  };

  // Leave stream
  const leaveStream = async () => {
    if (!user || !activeStream) return;

    // If YOU are the one recording, stop + save before leaving.
    if (activeStream.is_recording && activeStream.recorded_by === user.id) {
      await stopRecording();
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    await supabase
      .from('call_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('call_id', activeStream.id)
      .eq('user_id', user.id);

    setIsInStream(false);
    setHandRaised(false);
    await fetchActiveStream();
  };

  // End stream
  const endStream = async () => {
    if (!activeStream || !user || !conversationId) return;

    const streamTitle = activeStream.livestream_title || 'Live Stream';

    // Stop + save recording first (prevents losing audio when ending the stream).
    if (activeStream.is_recording && activeStream.recorded_by === user.id) {
      await stopRecording();
    }

    await supabase
      .from('calls')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', activeStream.id);

    // Send a system message to notify channel members that the stream ended
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `⚫ Live Stream Ended: "${streamTitle}"`,
        message_type: 'system',
      });

    await leaveStream();
  };

  // Raise hand
  const raiseHand = async () => {
    if (!user || !activeStream) return;

    await supabase
      .from('call_participants')
      .update({ hand_raised: true })
      .eq('call_id', activeStream.id)
      .eq('user_id', user.id);

    setHandRaised(true);
  };

  // Lower hand
  const lowerHand = async () => {
    if (!user || !activeStream) return;

    await supabase
      .from('call_participants')
      .update({ hand_raised: false })
      .eq('call_id', activeStream.id)
      .eq('user_id', user.id);

    setHandRaised(false);
  };

  // Toggle mute
  const toggleMute = async () => {
    if (!user || !activeStream || !localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const newMutedState = !audioTrack.enabled;

      await supabase
        .from('call_participants')
        .update({ is_muted: newMutedState })
        .eq('call_id', activeStream.id)
        .eq('user_id', user.id);

      setIsMuted(newMutedState);
    }
  };

  // Unmute participant (admin only)
  const unmuteParticipant = async (userId: string) => {
    if (!activeStream) return;

    await supabase
      .from('call_participants')
      .update({ is_muted: false, hand_raised: false })
      .eq('call_id', activeStream.id)
      .eq('user_id', userId);

    await fetchParticipants(activeStream.id);
  };

  // Mute participant (admin only)
  const muteParticipant = async (userId: string) => {
    if (!activeStream) return;

    await supabase
      .from('call_participants')
      .update({ is_muted: true })
      .eq('call_id', activeStream.id)
      .eq('user_id', userId);

    await fetchParticipants(activeStream.id);
  };

  // Toggle noise suppression
  const toggleNoiseSuppression = async () => {
    if (!user || !activeStream) return;

    const newValue = !noiseSuppression;
    setNoiseSuppression(newValue);

    await supabase
      .from('call_participants')
      .update({ noise_suppression: newValue })
      .eq('call_id', activeStream.id)
      .eq('user_id', user.id);

    // Re-initialize audio stream with new settings
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: newValue,
          autoGainControl: true,
        },
      });

      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });

      setLocalStream(stream);
    }
  };

  // Update stream title
  const updateStreamTitle = async (title: string) => {
    if (!activeStream) return;

    await supabase
      .from('calls')
      .update({ livestream_title: title })
      .eq('id', activeStream.id);

    setActiveStream(prev => (prev ? { ...prev, livestream_title: title } : null));
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeStream || !localStream) return;

    try {
      recordedChunks.current = [];

      // Pick a supported mimeType (prevents "start recording" failures on some browsers)
      const preferredMimeType = 'audio/webm;codecs=opus';
      let recorder: MediaRecorder;

      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(preferredMimeType)) {
        recorder = new MediaRecorder(localStream, { mimeType: preferredMimeType });
      } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')) {
        recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm' });
      } else {
        recorder = new MediaRecorder(localStream);
      }

      mediaRecorder.current = recorder;

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        await saveRecording(blob, title);
      };

      mediaRecorder.current.start(1000);

      await supabase
        .from('calls')
        .update({
          is_recording: true,
          recording_title: title,
          recorded_by: user.id,
        })
        .eq('id', activeStream.id);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Stop recording (always clears the backend "is_recording" flag; saves locally if possible)
  const stopRecording = async () => {
    if (!user || !activeStream) return;

    // Only the user who started the recording can stop it.
    if (activeStream.recorded_by && activeStream.recorded_by !== user.id) return;

    const recordingTitle = activeStream.recording_title || activeStream.livestream_title || 'Live Stream Recording';
    const recorder = mediaRecorder.current;

    console.log('Stopping recording...', { recordingTitle, hasRecorder: !!recorder, chunks: recordedChunks.current.length });

    try {
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }

        await new Promise<void>((resolve) => {
          recorder.onstop = async () => {
            try {
              console.log('Recorder stopped, chunks:', recordedChunks.current.length);
              if (recordedChunks.current.length > 0) {
                const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
                console.log('Saving recording blob, size:', blob.size);
                await saveRecording(blob, recordingTitle);
              } else {
                console.warn('No recorded chunks to save');
                toast.error('No audio recorded');
              }
            } catch (err) {
              console.error('Error saving recording on stop:', err);
              toast.error('Failed to save recording');
            } finally {
              resolve();
            }
          };

          try {
            recorder.stop();
          } catch (err) {
            console.error('Failed to stop recorder:', err);
            resolve();
          }
        });
      } else if (recordedChunks.current.length > 0) {
        // If recorder missing but chunks exist, save anyway
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        console.log('Saving orphaned chunks, size:', blob.size);
        await saveRecording(blob, recordingTitle);
      } else {
        console.warn('No recorder and no chunks to save');
      }
    } finally {
      mediaRecorder.current = null;
      recordedChunks.current = [];

      await supabase
        .from('calls')
        .update({ is_recording: false })
        .eq('id', activeStream.id);

      setIsRecording(false);
    }
  };

  // Save recording
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) {
      console.error('saveRecording: No user');
      return;
    }

    console.log('saveRecording called:', { title, blobSize: blob.size });
    toast.loading('Saving recording...', { id: 'save-recording' });

    try {
      const fileName = `recording_${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Uploading to storage:', filePath);
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Error uploading recording:', uploadError);
        toast.error('Failed to upload recording', { id: 'save-recording' });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      console.log('Uploaded, public URL:', publicUrl);

      // Find or create Saved Messages via edge function (more reliable)
      let savedConversationId: string | null = null;

      try {
        const { data, error } = await supabase.functions.invoke('create-conversation', {
          body: { type: 'saved' }
        });

        console.log('create-conversation result:', { data, error });

        if (!error && data?.id) {
          savedConversationId = data.id;
        }
      } catch (err) {
        console.error('Failed to get/create Saved Messages:', err);
      }

      if (!savedConversationId) {
        console.error('Could not get Saved Messages conversation');
        toast.error('Could not find Saved Messages', { id: 'save-recording' });
        return;
      }

      console.log('Inserting message into Saved Messages:', savedConversationId);

      // Create message with recording (store as a normal file; UI detects .webm as audio)
      const displayTitle = (title || 'Live Stream Recording').trim() || 'Live Stream Recording';
      const safeFileTitle = displayTitle.replace(/[\\/]/g, '-');

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: savedConversationId,
          sender_id: user.id,
          content: displayTitle,
          message_type: 'file',
          file_url: publicUrl,
          file_name: `${safeFileTitle}.webm`,
          file_size: blob.size,
        });

      if (msgError) {
        console.error('Error inserting recording message:', msgError);
        toast.error('Failed to save recording message', { id: 'save-recording' });
        return;
      }

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', savedConversationId);

      console.log('Recording saved successfully!');
      toast.success('Recording saved to Saved Messages', { id: 'save-recording' });
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording', { id: 'save-recording' });
    }
  };

  // Subscribe to changes
  useEffect(() => {
    if (!conversationId) return;

    fetchActiveStream();

    const channel = supabase
      .channel(`livestream-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `conversation_id=eq.${conversationId}` },
        () => fetchActiveStream()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_participants' },
        () => {
          if (activeStream) {
            fetchParticipants(activeStream.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchActiveStream, activeStream?.id]);

  // Handle participant cleanup (close PeerConnections for those who left)
  useEffect(() => {
    const participantUserIds = new Set(participants.map(p => p.user_id));

    peerConnections.current.forEach((pc, userId) => {
      if (!participantUserIds.has(userId)) {
        console.log(`📡 Closing PeerConnection for user who left: ${userId}`);
        pc.close();
        peerConnections.current.delete(userId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      }
    });
  }, [participants]);

  // Sync hardware mute state with database state
  useEffect(() => {
    if (!user || !activeStream || !localStream) return;

    const currentUserParticipant = participants.find(p => p.user_id === user.id);
    if (currentUserParticipant) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.enabled === currentUserParticipant.is_muted) {
        console.log(`🎤 Hardware Sync: Database says ${currentUserParticipant.is_muted ? 'MUTED' : 'UNMUTED'}. Toggling hardware...`);
        audioTrack.enabled = !currentUserParticipant.is_muted;
        setIsMuted(currentUserParticipant.is_muted);
      }
    }
  }, [participants, user, activeStream?.id, localStream]);

  // Thorough cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
    };
  }, [cleanup]);

  return {
    activeStream,
    participants,
    isInStream,
    localStream,
    remoteStreams,
    isRecording,
    handRaised,
    noiseSuppression,
    isMuted,
    startStream,
    joinStream,
    leaveStream,
    endStream,
    raiseHand,
    lowerHand,
    toggleMute,
    unmuteParticipant,
    muteParticipant,
    toggleNoiseSuppression,
    updateStreamTitle,
    startRecording,
    stopRecording
  };
}
