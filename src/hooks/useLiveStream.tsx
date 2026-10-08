import { createRecordingMixer } from '@/lib/recordingMixer';
import { getCallPreferences, updateCallPreference } from './useCallPreferences';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { CallParticipant } from './useCalls';
import { toast } from 'sonner';
import { getTurnCredentials, FALLBACK_ICE_SERVERS } from '@/lib/webrtc';

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

export function useLiveStream(conversationId: string | null, direct = false) {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInStream, setIsInStream] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(getCallPreferences().noiseSuppression);
  const [isMuted, setIsMuted] = useState(true); // Non-admins start muted
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordingMixer = useRef<Awaited<ReturnType<typeof createRecordingMixer>> | null>(null);
  useEffect(() => {
    if (localStream) recordingMixer.current?.update([localStream, ...remoteStreams.values()]);
  }, [localStream, remoteStreams]);
  const signalingChannel = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const joinedCallId = useRef<string | null>(null);
  const busy = useRef(false);
  const starting = useRef(false);
  const sessionGeneration = useRef(0);
  const activeFetchId = useRef(0);
  const stopRecordingRef = useRef<() => Promise<void>>();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const cleanup = useCallback(() => {
    sessionGeneration.current++;
    joinedCallId.current = null;
    busy.current = false;
    setIsInStream(false); setConnectionStatus('disconnected');
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }
  }, []);

  // Fetch active stream
  const fetchActiveStream = useCallback(async () => {
    if (!conversationId) return;
    const fetchId = ++activeFetchId.current;
    const requestedGeneration = sessionGeneration.current;

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
      return; // A transient fetch failure must not hide a working local call.
    }

    if (data) {
      setActiveStream(data as LiveStream);
      setIsRecording(data.is_recording);
      await fetchParticipants(data.id);
      return;
    }

    if (joinedCallId.current) {
      if (mediaRecorder.current?.state === 'recording') void stopRecordingRef.current?.().catch(() => toast.error('Recording could not finish saving.'));
      cleanup();
    }
    setActiveStream(null); setParticipants([]); setIsRecording(false);
  }, [conversationId, user?.id, cleanup]);

  // Store cached TURN config
  const turnConfigRef = useRef<RTCConfiguration | null>(null);

  const getOrCreatePC = useCallback(async (remoteUserId: string, stream: MediaStream, callId: string) => {
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId)!;
    }

    // Fetch TURN credentials if not cached
    if (!turnConfigRef.current) {
      turnConfigRef.current = await getTurnCredentials();
    }

    if (peerConnections.current.has(remoteUserId)) return peerConnections.current.get(remoteUserId)!;
    console.log(`📡 Creating PeerConnection for user: ${remoteUserId} with dynamic TURN`);
    const pc = new RTCPeerConnection(turnConfigRef.current);
    peerConnections.current.set(remoteUserId, pc);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote track
    pc.ontrack = (event) => {
      console.log(`🎵 Remote track received from ${remoteUserId}:`, event.track.kind);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(remoteUserId, remoteStream);
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        console.log(`📡 Sending ICE Candidate to ${remoteUserId}`);
        await supabase.from('call_signals').insert({
          call_id: callId,
          from_user: user.id,
          to_user: remoteUserId,
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as any
        });
      }
    };

    pc.oniceconnectionstatechange = async () => {
      if (pc.iceConnectionState === 'disconnected') setConnectionStatus('connecting');
      if (pc.iceConnectionState === 'failed' && pc.signalingState === 'stable' && user && user.id < remoteUserId) {
        try {
          pc.setConfiguration(await getTurnCredentials(true));
          const offer = await pc.createOffer({ iceRestart: true }); await pc.setLocalDescription(offer);
          const { error } = await supabase.from('call_signals').insert({ call_id: callId, from_user: user.id, to_user: remoteUserId, signal_type: 'offer', signal_data: { type: offer.type, sdp: offer.sdp } });
          if (error) throw error;
        } catch { setConnectionStatus('disconnected'); toast.error('Connection lost. Leave and rejoin the session.'); }
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`🚥 Signaling state with ${remoteUserId}: ${pc.signalingState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔌 Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      }
      if (pc.connectionState === 'failed') {
        console.warn(`Connection failed with ${remoteUserId}, attempting ICE restart...`);
        setConnectionStatus('connecting');
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
        setIsInStream(!!currentParticipant && joinedCallId.current === callId && !!localStreamRef.current);
        if (currentParticipant) {
          setHandRaised(currentParticipant.hand_raised || false);
          setIsMuted(currentParticipant.is_muted);
          setNoiseSuppression(currentParticipant.noise_suppression ?? true);
        }
      }
    }
  };


  // Listen for participant updates (e.g. being unmuted by admin)
  useEffect(() => {
    if (!activeStream?.id || !user?.id || !localStream) return;

    const channel = supabase
      .channel(`participant-updates-${user.id}-${activeStream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${activeStream.id}`
        },
        (payload: any) => {
          const newParticipant = payload.new;
          // Only care about updates to OUR record
          if (newParticipant.user_id !== user.id) return;

          if (newParticipant.left_at) { cleanup(); toast.info('You left the session.'); return; }
          console.log('🔔 Received participant update for self:', newParticipant);

          // Sync mute state
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const shouldBeMuted = newParticipant.is_muted;
            // Note: audioTrack.enabled = true means UNMUTED
            if (audioTrack.enabled === shouldBeMuted) {
              console.log('🔄 Syncing mute state to:', shouldBeMuted);
              audioTrack.enabled = !shouldBeMuted;
              setIsMuted(shouldBeMuted);

              if (!shouldBeMuted) {
                toast.success('You have been unmuted by the host');
              } else {
                toast.info('You have been muted by the host');
              }
            }
          }

          // Sync hand raise state
          if (newParticipant.hand_raised !== handRaised) {
            setHandRaised(newParticipant.hand_raised);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStream?.id, user?.id, localStream, handRaised]);

  // Start a new live stream
  const startStream = async (title: string = 'Live Stream'): Promise<string | null> => {
    if (!user || !conversationId) {
      console.log('Cannot start stream: missing user or conversationId');
      return null;
    }

    if (starting.current) return null;
    starting.current = true;
    const startingGeneration = sessionGeneration.current;
    let preparedStream: MediaStream | undefined;
    try {
    const { data: permission } = await supabase.from('conversation_participants').select('role').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle();
    if (!permission || (!direct && !['admin', 'owner'].includes(permission.role))) throw new Error('Only admins can start a session.');
    // If a stream is already active for this channel, just join it.
    const { data: existing, error: existingError } = await supabase
      .from('calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      console.log('Stream already active, joining instead of creating:', existing.id);
      await joinStream(existing.id, false);
      return existing.id;
    }

    // Ask for the microphone before announcing a call to the conversation.
    preparedStream = await navigator.mediaDevices.getUserMedia({ audio: getCallPreferences() });
    if (startingGeneration !== sessionGeneration.current) throw new Error('Starting the call was cancelled.');
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
      throw error;
    }

    console.log('Stream created:', data);

    // Join the stream immediately
    try {
      if (startingGeneration !== sessionGeneration.current) throw new Error('Starting the call was cancelled.');
      await joinStream(data.id, false, preparedStream);
    }
    catch (error) { await supabase.from('calls').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', data.id).eq('started_by', user.id); throw error; }
    // Send a system message to notify channel members
    if (!direct) try {
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

    void supabase.functions.invoke('send-push-notification', { body: { call_id: data.id } }).then(({ error }) => { if (error) console.warn('Call push could not be delivered'); });
    return data.id;
    } catch (error) {
      preparedStream?.getTracks().forEach(track => track.stop());
      throw error;
    } finally { starting.current = false; }
  };

  // Joining is an explicit local session, not inferred from a stale database row.
  const joinStream = async (callId: string, startMuted = true, preparedStream?: MediaStream) => {
    if (!user || !conversationId) throw new Error('Sign in before joining.');
    if (busy.current || (joinedCallId.current === callId && localStreamRef.current)) { preparedStream?.getTracks().forEach(track => track.stop()); return; }
    busy.current = true;
    const generation = sessionGeneration.current;
    const assertCurrent = () => { if (generation !== sessionGeneration.current) throw new Error('Joining was cancelled.'); };
    setConnectionStatus('connecting');
    try {
      const { data: call, error: callError } = await supabase.from('calls').select('*').eq('id', callId).eq('conversation_id', conversationId).eq('is_active', true).single();
      if (callError || !call) throw new Error('This session has ended. Refresh the channel.');
      const { data: member, error: memberError } = await supabase.from('conversation_participants').select('role').eq('conversation_id', conversationId).eq('user_id', user.id).single();
      if (memberError || !member) throw new Error('Join this channel before joining its call.');
      const muted = !direct && (startMuted || !['owner', 'admin'].includes(member.role));
      const stream = preparedStream || await navigator.mediaDevices.getUserMedia({ audio: getCallPreferences() });
      if (generation !== sessionGeneration.current) { stream.getTracks().forEach(track => track.stop()); throw new Error('Joining was cancelled.'); }
      localStreamRef.current = stream; setLocalStream(stream);
      stream.getAudioTracks().forEach(track => { track.enabled = !muted; });
      setIsMuted(muted);
      turnConfigRef.current = await getTurnCredentials();
      assertCurrent();
      if (!turnConfigRef.current.iceServers?.some(server => [server.urls].flat().some(url => /^turns?:/.test(url)))) toast.warning('Relay service is unavailable. Calls across different networks may fail.');
      const joinedAt = new Date().toISOString();
      const { data: old, error: oldError } = await supabase.from('call_participants').select('id').eq('call_id', callId).eq('user_id', user.id).limit(1).maybeSingle();
      assertCurrent();
      if (oldError) throw oldError;
      const row = { is_muted: muted, is_video_off: true, hand_raised: false, noise_suppression: getCallPreferences().noiseSuppression, left_at: null, joined_at: joinedAt };
      const result = old ? await supabase.from('call_participants').update(row).eq('id', old.id) : await supabase.from('call_participants').insert({ ...row, call_id: callId, user_id: user.id });
      assertCurrent();
      if (result.error) throw result.error;
      joinedCallId.current = callId; setActiveStream(call as LiveStream);
      const seen = new Set<string>();
      const queues = new Map<string, Promise<void>>();
      const pendingIce = new Map<string, RTCIceCandidateInit[]>();
      const send = async (remote: string, type: string, data: any) => {
        const { error } = await supabase.from('call_signals').insert({ call_id: callId, from_user: user.id, to_user: remote, signal_type: type, signal_data: data });
        if (error) throw error;
      };
      const handleSignal = (signal: any) => {
        if (generation !== sessionGeneration.current || signal.from_user === user.id || signal.to_user !== user.id || seen.has(signal.id)) return;
        seen.add(signal.id);
        const remote = signal.from_user;
        const task = (queues.get(remote) || Promise.resolve()).then(async () => {
          if (generation !== sessionGeneration.current) return;
          const pc = await getOrCreatePC(remote, stream, callId);
          if (signal.signal_type === 'ice-candidate') {
            if (!pc.remoteDescription) { pendingIce.set(remote, [...(pendingIce.get(remote) || []), signal.signal_data]); return; }
            await pc.addIceCandidate(signal.signal_data); return;
          }
          if (signal.signal_type === 'offer') {
            if (pc.signalingState !== 'stable') {
              if (user.id < remote) return; // Deterministic polite side resolves simultaneous offers.
              await pc.setLocalDescription({ type: 'rollback' });
            }
            await pc.setRemoteDescription(signal.signal_data);
            const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
            await send(remote, 'answer', { type: answer.type, sdp: answer.sdp });
          } else if (signal.signal_type === 'answer' && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(signal.signal_data);
          } else return;
          for (const candidate of pendingIce.get(remote) || []) await pc.addIceCandidate(candidate);
          pendingIce.delete(remote);
        }).catch(error => { console.warn('Call signaling failed:', error); setConnectionStatus('connecting'); });
        queues.set(remote, task);
      };
      const channel = supabase.channel(`livestream-signal-${callId}-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${callId}` }, payload => handleSignal(payload.new));
      signalingChannel.current = channel;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Could not connect signaling. Try joining again.')), 12000);
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error('Call signaling unavailable.')); }
        });
      });
      assertCurrent();
      // Replay any targeted signals received while the subscription was connecting.
      const { data: replay } = await supabase.from('call_signals').select('*').eq('call_id', callId).eq('to_user', user.id).gte('created_at', joinedAt).order('created_at');
      assertCurrent();
      replay?.forEach(handleSignal);
      const { data: activeParticipants, error: participantError } = await supabase.from('call_participants').select('user_id').eq('call_id', callId).is('left_at', null);
      assertCurrent();
      if (participantError) throw participantError;
      for (const remote of activeParticipants?.filter(row => row.user_id !== user.id) || []) {
        assertCurrent();
        const pc = await getOrCreatePC(remote.user_id, stream, callId);
        if (pc.signalingState !== 'stable' || pc.remoteDescription) continue;
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        await send(remote.user_id, 'offer', { type: offer.type, sdp: offer.sdp });
      }
      const { data: stillActive } = await supabase.from('calls').select('is_active').eq('id', callId).single();
      assertCurrent();
      if (!stillActive?.is_active) throw new Error('This session ended while you were joining.');
      setIsInStream(true);
      if (!activeParticipants?.some(row => row.user_id !== user.id)) setConnectionStatus('connected');
      await fetchParticipants(callId);
    } catch (error) {
      if (generation === sessionGeneration.current) cleanup();
      if (joinedCallId.current !== callId) await supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', callId).eq('user_id', user.id);
      throw error;
    } finally { if (generation === sessionGeneration.current || !joinedCallId.current) busy.current = false; }
  };

  const leaveStream = async () => {
    const callId = joinedCallId.current || activeStream?.id;
    if (!user || !callId || busy.current) return;
    busy.current = true;
    try {
      if (mediaRecorder.current?.state === 'recording') void stopRecording().catch(() => toast.error('Recording could not finish saving.'));
      if (direct) {
        const { data, error } = await supabase.from('calls').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', callId).select('id').single();
        if (error || !data) toast.error('Disconnected locally; ending the call could not sync.');
      }
      cleanup(); setHandRaised(false);
      const { error } = await supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', callId).eq('user_id', user.id);
      if (error) toast.error('Disconnected locally, but leaving could not sync. Check your connection.');
      await fetchActiveStream();
    } finally { busy.current = false; }
  };

  const endStream = async () => {
    if (!activeStream || !user || !conversationId || busy.current) return;
    busy.current = true;
    try {
      const { data: permission } = await supabase.from('conversation_participants').select('role').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle();
      if (!direct && activeStream.started_by !== user.id && !['owner', 'admin'].includes(permission?.role || '')) throw new Error('Only the host or an admin can end this session.');
      if (mediaRecorder.current?.state === 'recording') void stopRecording().catch(() => toast.error('Recording could not finish saving.'));
      const { data, error } = await supabase.from('calls').update({ is_active: false, is_recording: false, ended_at: new Date().toISOString() }).eq('id', activeStream.id).select('id').single();
      if (error || !data) throw new Error('Session could not be ended. Check your connection and try again.');
      cleanup(); setActiveStream(null); setParticipants([]);
      await supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', activeStream.id).eq('user_id', user.id);
      if (!direct) await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, content: `⚫ Live Stream Ended: "${activeStream.livestream_title || 'Live Stream'}"`, message_type: 'system' });
    } finally { busy.current = false; }
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
    updateCallPreference('noiseSuppression', newValue);
    setNoiseSuppression(newValue);

    await supabase
      .from('call_participants')
      .update({ noise_suppression: newValue })
      .eq('call_id', activeStream.id)
      .eq('user_id', user.id);

    // Apply constraints to the existing microphone; do not stop a track still sent to peers.
    try { await localStreamRef.current?.getAudioTracks()[0]?.applyConstraints({ noiseSuppression: newValue }); }
    catch { toast.error('This microphone cannot change noise suppression during a call.'); }
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
      recordingMixer.current?.dispose();
      recordingMixer.current = await createRecordingMixer(localStream, [...remoteStreams.values()]);

      // Pick a supported mimeType (prevents "start recording" failures on some browsers)
      const preferredMimeType = 'audio/webm;codecs=opus';
      let recorder: MediaRecorder;

      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(preferredMimeType)) {
        recorder = new MediaRecorder(recordingMixer.current.stream, { mimeType: preferredMimeType });
      } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')) {
        recorder = new MediaRecorder(recordingMixer.current.stream, { mimeType: 'audio/webm' });
      } else {
        recorder = new MediaRecorder(recordingMixer.current.stream);
      }

      mediaRecorder.current = recorder;

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
        await saveRecording(blob, title);
      };


      const { error: recordingError } = await supabase
        .from('calls')
        .update({
          is_recording: true,
          recording_title: title,
          recorded_by: user.id,
        })
        .eq('id', activeStream.id);

      if (recordingError) throw recordingError;
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      recordedChunks.current = [];
      const failedRecorder = mediaRecorder.current;
      if (failedRecorder) {
        failedRecorder.onstop = null;
        failedRecorder.ondataavailable = null;
        if (failedRecorder.state !== 'inactive') failedRecorder.stop();
      }
      mediaRecorder.current = null;
      setIsRecording(false);
      await supabase.from('calls').update({ is_recording: false }).eq('id', activeStream.id);
      recordingMixer.current?.dispose();
      recordingMixer.current = null;
      console.error('Error starting recording:', error);
      toast.error('Could not start recording. Please try again.');
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
                const blob = new Blob(recordedChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
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
        const blob = new Blob(recordedChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
        console.log('Saving orphaned chunks, size:', blob.size);
        await saveRecording(blob, recordingTitle);
      } else {
        console.warn('No recorder and no chunks to save');
      }
    } finally {
      mediaRecorder.current = null;
      recordingMixer.current?.dispose();
      recordingMixer.current = null;
      recordedChunks.current = [];

      await supabase
        .from('calls')
        .update({ is_recording: false })
        .eq('id', activeStream.id);

      setIsRecording(false);
    }
  };

  stopRecordingRef.current = stopRecording;

  // Save recording
  const saveRecording = async (blob: Blob, title: string) => {
    if (!user) {
      console.error('saveRecording: No user');
      return;
    }

    console.log('saveRecording called:', { title, blobSize: blob.size });
    toast.loading('Saving recording...', { id: 'save-recording' });

    try {
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `recording_${Date.now()}.${extension}`;
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

      // Channel recordings belong in the owner's Telegram-style Saved Messages.
      const { data: savedConversation, error: savedConversationError } = await supabase.functions.invoke('create-conversation', {
        body: { type: 'saved' }
      });
      const savedMessagesId = savedConversation?.id as string | undefined;

      if (savedConversationError || !savedMessagesId) {
        console.error('Could not create Saved Messages conversation:', savedConversationError);
        toast.error('Could not open Saved Messages', { id: 'save-recording' });
        return;
      }

      console.log('Inserting channel recording into Saved Messages:', savedMessagesId);

      // Create message with recording (store as a normal file; UI detects .webm as audio)
      const displayTitle = (title || 'Live Stream Recording').trim() || 'Live Stream Recording';
      const safeFileTitle = displayTitle.replace(/[\\\\/]/g, '-');

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: savedMessagesId,
          sender_id: user.id,
          content: displayTitle,
          message_type: 'file',
          file_url: publicUrl,
          file_name: `${safeFileTitle}.${extension}`,
          file_size: blob.size,
        });

      if (msgError) {
        console.error('Error inserting recording message:', msgError);
        toast.error('Failed to save recording to Saved Messages', { id: 'save-recording' });
        return;
      }

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', savedMessagesId);

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
        (payload: any) => {
          const row = payload.new;
          if (!activeStream || row?.call_id !== activeStream.id) return;
          if (row.left_at) {
            peerConnections.current.get(row.user_id)?.close();
            peerConnections.current.delete(row.user_id);
            setRemoteStreams(prev => { const next = new Map(prev); next.delete(row.user_id); return next; });
          }
          void fetchParticipants(activeStream.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchActiveStream, activeStream?.id]);

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
      const callId = joinedCallId.current;
      if (mediaRecorder.current?.state === 'recording') void stopRecordingRef.current?.();
      if (callId && user) {
        void supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', callId).eq('user_id', user.id).then(() => {});
        if (direct) void supabase.from('calls').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', callId).then(() => {});
      }
      cleanup();
    };
  }, [cleanup]);

  // Mute effect
  useEffect(() => {
    if (!user || !activeStream || !localStream) return;

    const currentUserParticipant = participants.find(p => p.user_id === user.id);
    if (currentUserParticipant) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const shouldBeEnabled = !currentUserParticipant.is_muted;
        if (audioTrack.enabled !== shouldBeEnabled) {
          console.log(`🎤 Hardware Sync: Participant state is ${currentUserParticipant.is_muted ? 'MUTED' : 'UNMUTED'}. Adjusting mic...`);
          audioTrack.enabled = shouldBeEnabled;
          setIsMuted(currentUserParticipant.is_muted);
        }
      }
    }
  }, [participants, user, activeStream?.id, localStream]);

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
    connectionStatus,
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
