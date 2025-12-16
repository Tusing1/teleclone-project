import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  profile?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useCalls(conversationId: string | null) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  // Fetch active call for conversation
  const fetchActiveCall = useCallback(async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      setActiveCall(data as Call);
      setIsRecording(data.is_recording);
      await fetchParticipants(data.id);
    } else {
      setActiveCall(null);
      setParticipants([]);
      setIsRecording(false);
    }
  }, [conversationId]);

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
        setIsInCall(participantsData.some(p => p.user_id === user.id));
      }
    }
  };

  // Start a new call (admin/owner only)
  const startCall = async (callType: 'voice' | 'video' = 'video'): Promise<string | null> => {
    if (!user || !conversationId) return null;

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

    try {
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      setLocalStream(stream);

      // Add participant to database
      await supabase
        .from('call_participants')
        .insert({
          call_id: callId,
          user_id: user.id,
          is_video_off: callType === 'voice'
        });

      setIsInCall(true);
      await fetchActiveCall();
    } catch (error) {
      console.error('Error joining call:', error);
    }
  };

  // Leave the call
  const leaveCall = async () => {
    if (!user || !activeCall) return;

    // Stop recording if active
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());

    // Update database
    await supabase
      .from('call_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id);

    setIsInCall(false);
    await fetchActiveCall();
  };

  // End call (only call starter)
  const endCall = async () => {
    if (!activeCall) return;

    // Stop recording and save if active
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    await supabase
      .from('calls')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString() 
      })
      .eq('id', activeCall.id);

    await leaveCall();
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeCall || !localStream) return;

    try {
      recordedChunks.current = [];
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      mediaRecorder.current = new MediaRecorder(localStream, options);

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
          recorded_by: user.id
        })
        .eq('id', activeCall.id);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!activeCall || !mediaRecorder.current) return;

    if (mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    await supabase
      .from('calls')
      .update({ is_recording: false })
      .eq('id', activeCall.id);

    setIsRecording(false);
  };

  // Save recording to storage and create message in Saved Messages
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) return;

    try {
      const fileName = `recording_${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Error uploading recording:', uploadError);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Find Saved Messages conversation (direct conversation with only current user)
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let savedConversationId: string | null = null;

      if (participantData) {
        for (const p of participantData) {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', p.conversation_id);

          // Saved Messages = direct conversation with only the current user
          if (participants?.length === 1 && participants[0].user_id === user.id) {
            savedConversationId = p.conversation_id;
            break;
          }
        }
      }

      // Create Saved Messages if it doesn't exist
      if (!savedConversationId) {
        const { data: newConversation } = await supabase
          .from('conversations')
          .insert({ type: 'direct' })
          .select()
          .single();

        if (newConversation) {
          savedConversationId = newConversation.id;
          
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: savedConversationId,
              user_id: user.id,
              role: 'owner'
            });
        }
      }

      if (savedConversationId) {
        // Create message with recording
        await supabase
          .from('messages')
          .insert({
            conversation_id: savedConversationId,
            sender_id: user.id,
            content: `🎙️ Recording: ${title || 'Call Recording'}`,
            message_type: 'file',
            file_url: publicUrl,
            file_name: `${title || 'Call Recording'}.webm`,
            file_size: blob.size
          });

        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', savedConversationId);
      }
    } catch (error) {
      console.error('Error saving recording:', error);
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