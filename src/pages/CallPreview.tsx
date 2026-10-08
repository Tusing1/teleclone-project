// Development-only visual QA. No microphone, notifications, calls or database writes.
import { useState } from 'react';
import { toast } from 'sonner';
import { AudioSessionView } from '@/components/chat/AudioSessionView';
import type { CallParticipant } from '@/hooks/useCalls';
export default function CallPreview() {
  const query = new URLSearchParams(location.search);
  const [muted, setMuted] = useState(query.has('member'));
  const [recording, setRecording] = useState(false);
  const [hand, setHand] = useState(false);
  const [noise, setNoise] = useState(true);
  const [title, setTitle] = useState('Late-night revision');
  const [mini, setMini] = useState(false);
  const [ended, setEnded] = useState(false);
  const participants: CallParticipant[] = ['You', 'Ward King', 'Amina'].map((name, i) => ({ id: name, call_id: 'preview', user_id: i ? name : 'preview', joined_at: '', left_at: null, is_muted: i !== 1, is_video_off: true, profile: { username: name, full_name: name, avatar_url: null } }));
  if (ended) return <div className="p-8">Preview ended. No real call was made.<button onClick={() => setEnded(false)}> Reopen preview</button></div>;
  return <AudioSessionView
    title={query.has('direct') ? 'Ward King' : title}
    subtitle={query.has('direct') ? 'DESIGN PREVIEW · no live audio' : 'Nurses Revision · DESIGN PREVIEW'}
    direct={query.has('direct')} currentUserId="preview"
    participants={query.has('direct') ? participants.slice(0, 2) : participants}
    localStream={null} remoteStreams={new Map()} isMuted={muted} isRecording={recording}
    canManage={!query.has('member')} canStopRecording connectionStatus="connected" silent
    onToggleMute={() => setMuted(v => !v)} onLeave={() => setEnded(true)} onEnd={() => setEnded(true)}
    onStartRecording={() => setRecording(true)} onStopRecording={() => setRecording(false)}
    handRaised={hand} onRaiseHand={query.has('direct') ? undefined : () => setHand(true)}
    onLowerHand={() => setHand(false)} noiseSuppression={noise} onToggleNoiseSuppression={() => setNoise(v => !v)}
    onUpdateTitle={query.has('direct') ? undefined : async name => setTitle(name)}
    onMuteParticipant={() => { toast.info('Design preview: no live microphone is changed.'); }}
    onUnmuteParticipant={() => { toast.info('Design preview: members accept an invitation before speaking.'); }}
    onMinimize={() => setMini(v => !v)} isMinimized={mini}
  />;
}
