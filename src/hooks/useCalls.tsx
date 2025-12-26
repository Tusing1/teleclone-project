import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

// Free STUN servers for NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
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
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const signalChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback((remoteUserId: string, callId: string, isInitiator: boolean) => {
    if (!user || !localStream) return null;

    console.log(`Creating peer connection for ${remoteUserId}, isInitiator: ${isInitiator}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current.set(remoteUserId, pc);

    // Add local tracks to the connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle incoming tracks (remote stream)
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteUserId}`);
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => new Map(prev).set(remoteUserId, remoteStream));
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${remoteUserId}`);
        await (supabase.from('call_signals') as any).insert({
          call_id: callId,
          from_user: user.id,
          to_user: remoteUserId,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate.toJSON() }
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`Connection ${pc.connectionState} with ${remoteUserId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${remoteUserId}: ${pc.iceConnectionState}`);
    };

    return pc;
  }, [user, localStream]);

  // Send SDP offer to a remote user
  const sendOffer = useCallback(async (remoteUserId: string, callId: string) => {
    if (!user) return;

    const pc = peerConnections.current.get(remoteUserId);
    if (!pc) return;

    try {
      console.log(`Creating offer for ${remoteUserId}`);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await (supabase.from('call_signals') as any).insert({
        call_id: callId,
        from_user: user.id,
        to_user: remoteUserId,
        signal_type: 'offer',
        signal_data: { type: 'offer', sdp: offer.sdp }
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [user]);

  // Handle incoming offer
  const handleOffer = useCallback(async (fromUserId: string, callId: string, sdp: string) => {
    if (!user || !localStream) return;

    console.log(`Received offer from ${fromUserId}`);
    
    let pc = peerConnections.current.get(fromUserId);
    if (!pc) {
      pc = createPeerConnection(fromUserId, callId, false);
      if (!pc) return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      
      // Add any pending ICE candidates
      const pending = pendingCandidates.current.get(fromUserId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current.delete(fromUserId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await (supabase.from('call_signals') as any).insert({
        call_id: callId,
        from_user: user.id,
        to_user: fromUserId,
        signal_type: 'answer',
        signal_data: { type: 'answer', sdp: answer.sdp }
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [user, localStream, createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (fromUserId: string, sdp: string) => {
    console.log(`Received answer from ${fromUserId}`);
    
    const pc = peerConnections.current.get(fromUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      
      // Add any pending ICE candidates
      const pending = pendingCandidates.current.get(fromUserId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current.delete(fromUserId);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    console.log(`Received ICE candidate from ${fromUserId}`);
    
    const pc = peerConnections.current.get(fromUserId);
    if (!pc || !pc.remoteDescription) {
      // Queue the candidate if we don't have a remote description yet
      const pending = pendingCandidates.current.get(fromUserId) || [];
      pending.push(candidate);
      pendingCandidates.current.set(fromUserId, pending);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  // Setup signaling channel for a call
  const setupSignaling = useCallback((callId: string) => {
    if (!user || signalChannel.current) return;

    console.log('Setting up signaling channel for call:', callId);

    const channel = supabase
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
            to_user: string | null;
            signal_type: string;
            signal_data: SignalData;
          };

          // Ignore our own signals
          if (signal.from_user === user.id) return;
          
          // Ignore signals not meant for us (unless broadcast)
          if (signal.to_user && signal.to_user !== user.id) return;

          console.log('Received signal:', signal.signal_type, 'from:', signal.from_user);

          switch (signal.signal_type) {
            case 'offer':
              if (signal.signal_data.sdp) {
                await handleOffer(signal.from_user, callId, signal.signal_data.sdp);
              }
              break;
            case 'answer':
              if (signal.signal_data.sdp) {
                await handleAnswer(signal.from_user, signal.signal_data.sdp);
              }
              break;
            case 'ice-candidate':
              if (signal.signal_data.candidate) {
                await handleIceCandidate(signal.from_user, signal.signal_data.candidate);
              }
              break;
          }
        }
      )
      .subscribe();

    signalChannel.current = channel;
  }, [user, handleOffer, handleAnswer, handleIceCandidate]);

  // Connect to existing participants
  const connectToParticipants = useCallback(async (callId: string, currentParticipants: CallParticipant[]) => {
    if (!user || !localStream) return;

    // Get other participants who are in the call
    const otherParticipants = currentParticipants.filter(
      p => p.user_id !== user.id && !p.left_at
    );

    console.log('Connecting to participants:', otherParticipants.length);

    for (const participant of otherParticipants) {
      // Only the user with smaller ID initiates to avoid duplicate connections
      if (user.id < participant.user_id) {
        if (!peerConnections.current.has(participant.user_id)) {
          const pc = createPeerConnection(participant.user_id, callId, true);
          if (pc) {
            await sendOffer(participant.user_id, callId);
          }
        }
      }
    }
  }, [user, localStream, createPeerConnection, sendOffer]);

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
      // If this user started multiple calls, close the older ones.
      if (user) {
        const { error: cleanupError } = await supabase
          .from('calls')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('is_active', true)
          .eq('started_by', user.id)
          .neq('id', data.id);

        if (cleanupError) {
          console.warn('Failed to cleanup duplicate calls:', cleanupError);
        }
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
      
      // Check if current user is in call
      if (user) {
        const userInCall = participantsData.some(p => p.user_id === user.id);
        setIsInCall(userInCall);
        
        // If we're in the call and have local stream, connect to other participants
        if (userInCall && localStream && activeCall) {
          await connectToParticipants(activeCall.id, participantsWithProfiles);
        }
      }
    }
  };

  // Start a new call (admin/owner only)
  const startCall = async (callType: 'voice' | 'video' = 'video'): Promise<string | null> => {
    if (!user || !conversationId) return null;

    // If a call is already active, just join it.
    const { data: existing, error: existingError } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) {
      const existingType: 'voice' | 'video' = existing.call_type === 'voice' ? 'voice' : 'video';
      await joinCall(existing.id, existingType);
      return existing.id;
    }

    // Cleanup any other active calls started by this same user (prevents duplicates).
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

    // Join the call immediately
    await joinCall(data.id, callType);
    return data.id;
  };

  // Join an existing call
  const joinCall = async (callId: string, callType: 'voice' | 'video' = 'video') => {
    if (!user) return;

    setConnectionStatus('connecting');

    try {
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      setLocalStream(stream);

      // Setup signaling before adding participant
      setupSignaling(callId);

      // Ensure the user has only one active participant row per call.
      const { data: existingParticipant, error: existingParticipantError } = await supabase
        .from('call_participants')
        .select('id')
        .eq('call_id', callId)
        .eq('user_id', user.id)
        .is('left_at', null)
        .limit(1)
        .maybeSingle();

      if (existingParticipantError) {
        console.warn('Error checking existing call participant:', existingParticipantError);
      }

      if (existingParticipant?.id) {
        await supabase
          .from('call_participants')
          .update({ is_video_off: callType === 'voice' })
          .eq('id', existingParticipant.id);
      } else {
        // Add participant to database
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

      // Wait a bit for the participant to be registered, then connect to others
      setTimeout(async () => {
        const { data: currentParticipants } = await supabase
          .from('call_participants')
          .select('*')
          .eq('call_id', callId)
          .is('left_at', null);
        
        if (currentParticipants) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, full_name, avatar_url')
            .in('user_id', currentParticipants.map(p => p.user_id));

          const participantsWithProfiles = currentParticipants.map(p => ({
            ...p,
            profile: profiles?.find(pr => pr.user_id === p.user_id)
          })) as CallParticipant[];

          await connectToParticipants(callId, participantsWithProfiles);
        }
      }, 1000);

    } catch (error) {
      console.error('Error joining call:', error);
      setConnectionStatus('disconnected');
      toast.error('Failed to join call. Please check your camera/microphone permissions.');
    }
  };

  // Leave the call
  const leaveCall = async () => {
    if (!user || !activeCall) return;

    // If YOU are the one recording, stop + save before leaving.
    if (activeCall.is_recording && activeCall.recorded_by === user.id) {
      await stopRecording();
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    setRemoteStreams(new Map());

    // Remove signaling channel
    if (signalChannel.current) {
      supabase.removeChannel(signalChannel.current);
      signalChannel.current = null;
    }

    // Clean up signals
    await supabase
      .from('call_signals')
      .delete()
      .eq('call_id', activeCall.id)
      .eq('from_user', user.id);

    // Update database
    await supabase
      .from('call_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id);

    setIsInCall(false);
    setConnectionStatus('disconnected');
    await fetchActiveCall();
  };

  // End call (only call starter)
  const endCall = async () => {
    if (!user || !activeCall) return;

    // Stop + save recording first (prevents losing audio when ending the call).
    if (activeCall.is_recording && activeCall.recorded_by === user.id) {
      await stopRecording();
    }

    // Clean up all signals for this call
    await supabase
      .from('call_signals')
      .delete()
      .eq('call_id', activeCall.id);

    await supabase
      .from('calls')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', activeCall.id);

    await leaveCall();
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeCall || !localStream) return;

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

      mediaRecorder.current.start(1000); // Collect data every second

      // Update database
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
    }
  };

  // Stop recording (always clears the backend "is_recording" flag; saves locally if possible)
  const stopRecording = async () => {
    if (!user || !activeCall) return;

    // Only the user who started the recording can stop it.
    if (activeCall.recorded_by && activeCall.recorded_by !== user.id) return;

    const recordingTitle = activeCall.recording_title || 'Call Recording';
    const recorder = mediaRecorder.current;

    console.log('Stopping call recording...', { recordingTitle, hasRecorder: !!recorder, chunks: recordedChunks.current.length });

    try {
      // If we have an active local recorder, stop and WAIT for onstop -> save.
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }

        await new Promise<void>((resolve) => {
          recorder.onstop = async () => {
            try {
              console.log('Call recorder stopped, chunks:', recordedChunks.current.length);
              if (recordedChunks.current.length > 0) {
                const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
                console.log('Saving call recording blob, size:', blob.size);
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
        // If the recorder is missing but chunks exist, try saving anyway.
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        console.log('Saving orphaned call chunks, size:', blob.size);
        await saveRecording(blob, recordingTitle);
      } else {
        console.warn('No recorder and no chunks to save for call');
      }
    } finally {
      // Always clear local state so the UI can't get stuck.
      mediaRecorder.current = null;
      recordedChunks.current = [];

      // Always clear backend recording flag (prevents "can't stop recording").
      await supabase
        .from('calls')
        .update({ is_recording: false })
        .eq('id', activeCall.id);

      setIsRecording(false);
    }
  };

  // Save recording to storage and create message in Saved Messages
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) {
      console.error('saveRecording: No user');
      return;
    }

    console.log('saveRecording (call) called:', { title, blobSize: blob.size });
    toast.loading('Saving recording...', { id: 'save-call-recording' });

    try {
      const fileName = `recording_${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Uploading call recording to storage:', filePath);
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Error uploading recording:', uploadError);
        toast.error('Failed to upload recording', { id: 'save-call-recording' });
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      console.log('Uploaded call recording, public URL:', publicUrl);

      // Use edge function to get or create Saved Messages (more reliable)
      let savedConversationId: string | null = null;

      try {
        const { data, error } = await supabase.functions.invoke('create-conversation', {
          body: { type: 'saved' }
        });

        console.log('create-conversation result for call:', { data, error });

        if (!error && data?.id) {
          savedConversationId = data.id;
        }
      } catch (err) {
        console.error('Failed to get/create Saved Messages for call recording:', err);
      }

      if (!savedConversationId) {
        console.error('Could not get Saved Messages conversation for call');
        toast.error('Could not find Saved Messages', { id: 'save-call-recording' });
        return;
      }

      console.log('Inserting call recording message into Saved Messages:', savedConversationId);

      // Create message with recording (store as a normal file; UI detects .webm as audio)
      const displayTitle = (title || 'Call Recording').trim() || 'Call Recording';
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
        console.error('Error inserting call recording message:', msgError);
        toast.error('Failed to save recording message', { id: 'save-call-recording' });
        return;
      }

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', savedConversationId);

      console.log('Call recording saved successfully!');
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
      
      await supabase
        .from('call_participants')
        .update({ is_video_off: !videoTrack.enabled })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      peerConnections.current.forEach(pc => pc.close());
      if (signalChannel.current) {
        supabase.removeChannel(signalChannel.current);
      }
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
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    toggleVideo,
    startRecording,
    stopRecording
  };
}
