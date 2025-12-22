import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CallParticipant } from './useCalls';

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
  const [isRecording, setIsRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Non-admins start muted
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  // Fetch active stream
  const fetchActiveStream = useCallback(async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      setActiveStream(data as LiveStream);
      setIsRecording(data.is_recording);
      await fetchParticipants(data.id);
    } else {
      setActiveStream(null);
      setParticipants([]);
      setIsRecording(false);
    }
  }, [conversationId]);

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
    if (!user || !conversationId) return null;

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

    await joinStream(data.id, false); // Admin starts unmuted
    return data.id;
  };

  // Join stream
  const joinStream = async (callId: string, startMuted: boolean = true) => {
    if (!user) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseSuppression,
          autoGainControl: true
        }
      });

      // Mute by default for non-admins
      stream.getAudioTracks().forEach(track => {
        track.enabled = !startMuted;
      });

      setLocalStream(stream);
      setIsMuted(startMuted);

      await supabase
        .from('call_participants')
        .insert({
          call_id: callId,
          user_id: user.id,
          is_muted: startMuted,
          is_video_off: true,
          hand_raised: false,
          noise_suppression: noiseSuppression
        });

      setIsInStream(true);
      await fetchActiveStream();
    } catch (error) {
      console.error('Error joining stream:', error);
    }
  };

  // Leave stream
  const leaveStream = async () => {
    if (!user || !activeStream) return;

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
    if (!activeStream) return;

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    await supabase
      .from('calls')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString() 
      })
      .eq('id', activeStream.id);

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
          autoGainControl: true
        }
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

    setActiveStream(prev => prev ? { ...prev, livestream_title: title } : null);
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeStream || !localStream) return;

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

      mediaRecorder.current.start(1000);

      await supabase
        .from('calls')
        .update({ 
          is_recording: true, 
          recording_title: title,
          recorded_by: user.id
        })
        .eq('id', activeStream.id);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!activeStream || !mediaRecorder.current) return;

    if (mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    await supabase
      .from('calls')
      .update({ is_recording: false })
      .eq('id', activeStream.id);

    setIsRecording(false);
  };

  // Save recording
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) return;

    try {
      const fileName = `recording_${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Error uploading recording:', uploadError);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Save to user's saved messages
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

          if (participants?.length === 1 && participants[0].user_id === user.id) {
            savedConversationId = p.conversation_id;
            break;
          }
        }
      }

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
        await supabase
          .from('messages')
          .insert({
            conversation_id: savedConversationId,
            sender_id: user.id,
            content: `🎙️ Recording: ${title || 'Live Stream Recording'}`,
            message_type: 'file',
            file_url: publicUrl,
            file_name: `${title || 'Live Stream Recording'}.webm`,
            file_size: blob.size
          });

        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', savedConversationId);
      }
    } catch (error) {
      console.error('Error saving recording:', error);
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  return {
    activeStream,
    participants,
    isInStream,
    localStream,
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
