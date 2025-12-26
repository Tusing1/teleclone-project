import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC, { 
  IAgoraRTCClient, 
  IMicrophoneAudioTrack, 
  ICameraVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  IAgoraRTCRemoteUser
} from 'agora-rtc-sdk-ng';
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

export interface RemoteUserTracks {
  audioTrack?: IRemoteAudioTrack;
  videoTrack?: IRemoteVideoTrack;
}

export function useCalls(conversationId: string | null) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<string, RemoteUserTracks>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const agoraClient = useRef<IAgoraRTCClient | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const agoraUid = useRef<number>(0);

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClient.current) {
      agoraClient.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Handle remote user events
      agoraClient.current.on('user-published', async (remoteUser, mediaType) => {
        console.log('Remote user published:', remoteUser.uid, mediaType);
        
        if (!agoraClient.current) return;
        
        await agoraClient.current.subscribe(remoteUser, mediaType);
        console.log('Subscribed to:', remoteUser.uid, mediaType);

        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(remoteUser.uid)) || {};
          
          if (mediaType === 'audio') {
            existing.audioTrack = remoteUser.audioTrack;
            // Auto-play audio
            remoteUser.audioTrack?.play();
          } else if (mediaType === 'video') {
            existing.videoTrack = remoteUser.videoTrack;
          }
          
          newMap.set(String(remoteUser.uid), existing);
          return newMap;
        });
      });

      agoraClient.current.on('user-unpublished', (remoteUser, mediaType) => {
        console.log('Remote user unpublished:', remoteUser.uid, mediaType);
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(remoteUser.uid));
          
          if (existing) {
            if (mediaType === 'audio') {
              existing.audioTrack = undefined;
            } else if (mediaType === 'video') {
              existing.videoTrack = undefined;
            }
            
            if (!existing.audioTrack && !existing.videoTrack) {
              newMap.delete(String(remoteUser.uid));
            } else {
              newMap.set(String(remoteUser.uid), existing);
            }
          }
          
          return newMap;
        });
      });

      agoraClient.current.on('user-left', (remoteUser) => {
        console.log('Remote user left:', remoteUser.uid);
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(String(remoteUser.uid));
          return newMap;
        });
      });

      agoraClient.current.on('connection-state-change', (curState, prevState) => {
        console.log('Agora connection state:', prevState, '->', curState);
        if (curState === 'CONNECTED') {
          setConnectionStatus('connected');
        } else if (curState === 'CONNECTING' || curState === 'RECONNECTING') {
          setConnectionStatus('connecting');
        } else {
          setConnectionStatus('disconnected');
        }
      });
    }

    return () => {
      if (agoraClient.current) {
        agoraClient.current.removeAllListeners();
      }
    };
  }, []);

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

  // Get Agora token from edge function
  const getAgoraToken = async (channelName: string): Promise<{ token: string; appId: string; uid: number } | null> => {
    try {
      console.log('Requesting Agora token for channel:', channelName);
      
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: { channelName, uid: user?.id }
      });

      if (error) {
        console.error('Error getting Agora token:', error);
        return null;
      }

      console.log('Got Agora token response:', { appId: data.appId, uid: data.uid });
      return data;
    } catch (error) {
      console.error('Error invoking agora-token function:', error);
      return null;
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

    await joinCall(data.id, callType);
    return data.id;
  };

  // Join an existing call
  const joinCall = async (callId: string, callType: 'voice' | 'video' = 'video') => {
    if (!user || !agoraClient.current) return;

    setConnectionStatus('connecting');

    try {
      // Get Agora token
      const tokenData = await getAgoraToken(callId);
      if (!tokenData) {
        throw new Error('Failed to get Agora token');
      }

      const { token, appId, uid } = tokenData;
      agoraUid.current = uid;

      console.log('Joining Agora channel:', callId, 'with uid:', uid);

      // Join the channel
      await agoraClient.current.join(appId, callId, token, uid);
      console.log('Joined Agora channel successfully');

      // Create local tracks
      const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
        { encoderConfig: 'speech_standard' },
        { 
          encoderConfig: '480p_1',
          optimizationMode: 'detail'
        }
      );

      const [audioTrack, videoTrack] = tracks;
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      // Publish tracks
      if (callType === 'video') {
        await agoraClient.current.publish([audioTrack, videoTrack]);
      } else {
        await agoraClient.current.publish([audioTrack]);
        videoTrack.close();
        setLocalVideoTrack(null);
      }

      console.log('Published local tracks');

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
      setConnectionStatus('connected');
      await fetchActiveCall();

    } catch (error) {
      console.error('Error joining call:', error);
      setConnectionStatus('disconnected');
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

    // Stop and close local tracks
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
      setLocalVideoTrack(null);
    }

    // Leave Agora channel
    if (agoraClient.current) {
      await agoraClient.current.leave();
    }

    setRemoteUsers(new Map());

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

    await leaveCall();
  };

  // Start recording
  const startRecording = async (title: string) => {
    if (!user || !activeCall || !localAudioTrack) return;

    try {
      recordedChunks.current = [];

      // Get the MediaStreamTrack from Agora audio track
      const mediaStreamTrack = localAudioTrack.getMediaStreamTrack();
      const stream = new MediaStream([mediaStreamTrack]);

      const preferredMimeType = 'audio/webm;codecs=opus';
      let recorder: MediaRecorder;

      if (MediaRecorder.isTypeSupported(preferredMimeType)) {
        recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } else {
        recorder = new MediaRecorder(stream);
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
    if (!user || !activeCall || !localAudioTrack) return;

    const newMuted = localAudioTrack.enabled;
    await localAudioTrack.setEnabled(!newMuted);

    await supabase
      .from('call_participants')
      .update({ is_muted: newMuted })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id);
  };

  // Toggle video
  const toggleVideo = async () => {
    if (!user || !activeCall || !localVideoTrack) return;

    const newVideoOff = localVideoTrack.enabled;
    await localVideoTrack.setEnabled(!newVideoOff);

    await supabase
      .from('call_participants')
      .update({ is_video_off: newVideoOff })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id);
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
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (agoraClient.current) {
        agoraClient.current.leave();
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
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
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
