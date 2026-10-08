import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { holdCallActivity } from '@/lib/callActivity';
import { AudioWaveform, ChevronDown, Circle, Hand, Loader2, Mic, MicOff, PhoneOff, Settings2, Square, Volume2, VolumeX } from 'lucide-react';
import { Avatar } from './Avatar';
import { RemoteAudioPlayer } from './RemoteAudioPlayer';
import type { CallParticipant } from '@/hooks/useCalls';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { useCallSounds } from '@/hooks/useCallSounds';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Action = () => void | Promise<void>;
export interface AudioSessionProps {
  title: string; subtitle: string; avatar?: string; direct?: boolean;
  participants: CallParticipant[]; currentUserId: string;
  localStream: MediaStream | null; remoteStreams: Map<string, MediaStream>;
  isMuted: boolean; isRecording: boolean; canManage: boolean; canStopRecording: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected'; startedAt?: string;
  onToggleMute: Action; onLeave: Action; onEnd: Action;
  onStartRecording: (title: string) => void | Promise<void>; onStopRecording: Action;
  handRaised?: boolean; onRaiseHand?: Action; onLowerHand?: Action;
  noiseSuppression?: boolean; onToggleNoiseSuppression?: Action;
  onMuteParticipant?: (id: string) => void | Promise<void>;
  onUnmuteParticipant?: (id: string) => void | Promise<void>;
  onUpdateTitle?: (title: string) => void | Promise<void>;
  onMinimize?: Action; isMinimized?: boolean; silent?: boolean;
}

function Member({ participant, stream, local, muted, manage, onMute, onInvite }: {
  participant: CallParticipant; stream: MediaStream | null; local: boolean; muted: boolean;
  manage: boolean; onMute?: Action; onInvite?: Action;
}) {
  const { isSpeaking, audioLevel } = useAudioLevel(stream);
  const speaking = isSpeaking && !muted;
  return <div className={cn('sg-call-member', speaking && 'sg-call-member-speaking')}>
    <div className="relative shrink-0">
      <Avatar name={participant.profile?.full_name || participant.profile?.username || (local ? 'You' : 'Member')} src={participant.profile?.avatar_url} size="lg" />
      <span className={cn('sg-call-mic-badge', muted ? 'text-white/50' : 'text-emerald-300')}>{muted ? <MicOff size={13} /> : <Mic size={13} />}</span>
    </div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{local ? 'You' : participant.profile?.full_name || participant.profile?.username || 'Member'}</p>
      <p className={cn('mt-1 text-xs', speaking ? 'text-emerald-300' : 'text-white/50')}>{participant.hand_raised ? '✋ Wants to speak' : muted ? 'Microphone off' : speaking ? 'Speaking' : 'Microphone on'}</p>
    </div>
    <div className="sg-call-wave" aria-hidden="true">{[.45, .8, 1, .65, .4].map((n, i) => <i key={i} style={{ height: speaking ? `${4 + audioLevel * 24 * n}px` : '4px' }} />)}</div>
    {manage && !local && (muted ? onInvite : onMute) && <Button variant="ghost" className="rounded-xl bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white" onClick={muted ? onInvite : onMute}>{muted ? 'Ask to unmute' : 'Mute'}</Button>}
  </div>;
}

export function AudioSessionView(props: AudioSessionProps) {
  const { title, subtitle, avatar, direct, participants, currentUserId, localStream, remoteStreams, isMuted, isRecording, canManage, canStopRecording, connectionStatus, onLeave, onEnd, onToggleMute, onStartRecording, onStopRecording, isMinimized, onMinimize } = props;
  const [panel, setPanel] = useState<'record' | 'settings' | 'end' | null>(null);
  const [consent, setConsent] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [editedTitle, setEditedTitle] = useState(title);
  const [pending, setPending] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [deafened, setDeafened] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const joinedAt = useRef(Date.now());
  const { playJoinTone, playEndTone, playControlTone } = useCallSounds();
  const sounded = useRef(false);
  const surface = useRef<HTMLElement>(null);
  const others = participants.filter(p => p.user_id !== currentUserId);
  const local = participants.find(p => p.user_id === currentUserId) || { id: 'local', call_id: '', user_id: currentUserId, joined_at: '', left_at: null, is_muted: isMuted, is_video_off: true };
  const status = connectionStatus === 'disconnected' ? 'Connection lost · leave and rejoin' : connectionStatus === 'connecting' ? 'Connecting audio…' : others.length === 0 ? (direct ? 'Waiting for an answer…' : 'Room ready · waiting for others') : 'Connected';
  useEffect(() => { setEditedTitle(title); }, [title]);
  useEffect(() => { if (!props.silent) return holdCallActivity(); }, [props.silent]);
  useEffect(() => {
    if (isMinimized || panel) return;
    const previous = document.activeElement as HTMLElement | null;
    surface.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []);
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (!first) return;
      if (!surface.current?.contains(document.activeElement) || (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === surface.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [isMinimized, panel]);
  useEffect(() => { if (connectionStatus === 'connected' && !sounded.current && !props.silent) { sounded.current = true; playJoinTone(); } }, [connectionStatus, playJoinTone, props.silent]);
  useEffect(() => {
    const start = props.startedAt ? Date.parse(props.startedAt) : joinedAt.current;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - (Number.isFinite(start) ? start : joinedAt.current)) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [props.startedAt]);
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  async function run(name: string, action: Action, close = false) {
    if (actionLock.current) return;
    actionLock.current = true; setPending(name);
    try { await action(); if (close) setPanel(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'That action failed. Please try again.'); }
    finally { actionLock.current = false; setPending(null); }
  }
  const leave = () => run('leave', async () => { await onLeave(); if (!props.silent) playEndTone(); });
  const control = (label: string, icon: React.ReactNode, action: Action, active = false) => <button type="button" className={cn('sg-call-control', active && 'sg-call-control-active')} disabled={!!pending} aria-pressed={active} onClick={() => void run(label, action)}><span>{pending === label ? <Loader2 className="animate-spin" size={22} /> : icon}</span><small>{label}</small></button>;
  return createPortal(<>
    <section ref={surface} tabIndex={-1} role={isMinimized ? 'region' : 'dialog'} aria-modal={isMinimized ? undefined : true} className={cn('sg-call-shell', isMinimized && 'sg-call-mini')} aria-label={direct ? 'Voice call' : 'Live audio room'}>
      <header className="sg-call-header">
        <div className="flex min-w-0 items-center gap-3"><Avatar name={title} src={avatar} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-0.5 truncate text-xs text-white/50">{direct ? 'Voice call' : 'Live audio room'} · <span className="tabular-nums">{duration}</span></p></div></div>
        <div className="flex shrink-0 items-center gap-2">
          {isRecording && <span className="sg-call-recording"><Circle size={8} fill="currentColor" /> REC</span>}
          {isMinimized ? <><Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={onMinimize}>Open</Button><Button variant="ghost" aria-label="Leave session" className="text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" disabled={!!pending} onClick={direct ? () => setPanel('end') : leave}><PhoneOff size={20} /></Button></> : <>
            <button className="sg-call-icon" aria-label="Audio settings" onClick={() => setPanel('settings')}><Settings2 size={20} /></button>
            {onMinimize && <button className="sg-call-icon" aria-label="Minimize session and return to chat" onClick={onMinimize}><ChevronDown size={22} /></button>}
          </>}
        </div>
      </header>
      {!isMinimized && <>
        <main className="sg-call-main">
          <div className="sg-call-hero">
            <span className="sg-call-eyebrow"><AudioWaveform size={14} /> {direct ? 'JUST YOU TWO' : 'YOUR STUDY CIRCLE'}</span>
            {direct && <div className="sg-call-portrait"><Avatar name={title} src={avatar} size="xl" /></div>}
            <h1>{title}</h1><p className="sg-call-subtitle">{subtitle}</p>
            <div role="status" className="sg-call-status"><i className={cn(connectionStatus === 'connected' ? 'bg-emerald-300' : connectionStatus === 'connecting' ? 'bg-amber-300 motion-safe:animate-pulse' : 'bg-rose-300')} />{status}</div>
            {isRecording && <p className="mt-3 text-xs text-rose-200">This session is being recorded{!canStopRecording ? ' by the host' : ''}.</p>}
          </div>
          <div className="sg-call-roster"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-xs font-semibold text-white/60">IN THE ROOM</h2><span className="text-xs text-white/40">{others.length + 1} {others.length ? 'people' : 'person'}</span></div>
            <Member participant={{ ...local, hand_raised: props.handRaised }} stream={localStream} local muted={isMuted} manage={false} />
            {others.map(p => <Member key={p.user_id} participant={p} stream={remoteStreams.get(p.user_id) || null} local={false} muted={p.is_muted} manage={canManage} onMute={props.onMuteParticipant && (() => run('member', () => props.onMuteParticipant!(p.user_id)))} onInvite={props.onUnmuteParticipant && (() => run('member', () => props.onUnmuteParticipant!(p.user_id)))} />)}
            {!others.length && <p className="px-3 py-5 text-center text-xs leading-relaxed text-white/40">{direct ? 'Your friend will appear here when they answer.' : 'Members can join from the live session button in your channel.'}</p>}
          </div>
        </main>
        <footer className="sg-call-footer">
          <p className="mb-4 text-center text-xs text-white/50" aria-live="polite">{isMuted ? 'Your microphone is off. Tap Unmute to speak.' : 'Your microphone is on. Others can hear you.'}</p>
          <div className="sg-call-dock">
            {control(deafened ? 'Hear audio' : 'Audio on', deafened ? <VolumeX size={22} /> : <Volume2 size={22} />, () => setDeafened(v => !v), deafened)}
            {props.onRaiseHand && control(props.handRaised ? 'Lower hand' : 'Raise hand', <Hand size={22} />, props.handRaised ? props.onLowerHand! : props.onRaiseHand, props.handRaised)}
            {control(isMuted ? 'Unmute' : 'Mute', isMuted ? <MicOff size={25} /> : <Mic size={25} />, async () => { await onToggleMute(); if (!props.silent) playControlTone(); }, !isMuted)}
            {canManage && (!isRecording || canStopRecording) && control(isRecording ? 'Stop & save' : 'Record', isRecording ? <Square size={20} fill="currentColor" /> : <Circle size={22} />, isRecording ? onStopRecording : () => { setConsent(false); setRecordTitle(title); setPanel('record'); }, isRecording)}
            <button className="sg-call-control sg-call-control-leave" disabled={!!pending} onClick={direct ? () => setPanel('end') : leave}><span>{pending === 'leave' ? <Loader2 size={23} className="animate-spin" /> : <PhoneOff size={23} />}</span><small>{direct ? 'End call' : 'Leave'}</small></button>
          </div>
          {!direct && canManage && <button className="sg-call-end-link" disabled={!!pending} onClick={() => setPanel('end')}>End session for everyone</button>}
        </footer>
      </>}
      <div className="sg-call-playback">{Array.from(remoteStreams.entries()).map(([id, stream]) => <RemoteAudioPlayer key={id} stream={stream} muted={deafened} />)}</div>
    </section>
    <Dialog open={!!panel} onOpenChange={open => { if (!open && !pending) setPanel(null); }}>
      <DialogContent className="sg-call-dialog">
        <DialogHeader><DialogTitle>{panel === 'record' ? 'Record this session' : panel === 'end' ? (direct ? 'End this call?' : 'End for everyone?') : 'Audio settings'}</DialogTitle><DialogDescription>{panel === 'record' ? 'Audio saves to your Saved Messages when you stop. Share it to the channel when ready.' : panel === 'end' ? 'Everyone will be disconnected. Any recording you started will finish saving.' : 'Keep your microphone and listening controls in one place.'}</DialogDescription></DialogHeader>
        {panel === 'record' && <><label className="space-y-2 text-sm">Recording name<Input value={recordTitle} onChange={e => setRecordTitle(e.target.value)} maxLength={120} className="mt-2" /></label><label className="flex items-start gap-3 text-sm leading-relaxed"><Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} className="mt-1" />Everyone has agreed to be recorded.</label><Button disabled={!consent || !!pending} onClick={() => void run('record', () => onStartRecording(recordTitle.trim() || title), true)}>{pending ? 'Starting…' : 'Start recording'}</Button></>}
        {panel === 'end' && <div className="grid gap-2"><Button variant="destructive" disabled={!!pending} onClick={() => void run('end', async () => { await onEnd(); if (!props.silent) playEndTone(); }, true)}>{pending ? 'Ending…' : direct ? 'End call' : 'End session for everyone'}</Button><Button variant="ghost" disabled={!!pending} onClick={() => setPanel(null)}>Keep talking</Button></div>}
        {panel === 'settings' && <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Listening: {deafened ? 'off' : 'on'}. Use the audio button to mute playback; this does not change your microphone or phone speaker routing.</p>
          {props.onToggleNoiseSuppression && <label className="flex items-center justify-between gap-4 text-sm"><span>Reduce background noise</span><Switch aria-label="Reduce background noise" checked={props.noiseSuppression} disabled={!!pending} onCheckedChange={() => void run('noise', props.onToggleNoiseSuppression!)} /></label>}
          {props.onUpdateTitle && canManage && <><label className="text-sm">Session title<Input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} maxLength={120} className="mt-2" /></label><Button className="w-full" disabled={!!pending || !editedTitle.trim()} onClick={() => void run('title', () => props.onUpdateTitle!(editedTitle.trim()), true)}>{pending ? 'Saving…' : 'Save title'}</Button></>}
        </div>}
      </DialogContent>
    </Dialog>
  </>, document.body);
}
