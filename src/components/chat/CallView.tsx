import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Users, Circle, Wifi, WifiOff, Volume2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { CallParticipant } from '@/hooks/useCalls';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { RemoteAudioPlayer } from './RemoteAudioPlayer';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCallSounds } from '@/hooks/useCallSounds';

// Format seconds into MM:SS or HH:MM:SS
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
interface CallViewProps {
  callType: 'voice';
  participants: CallParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isCallStarter: boolean;
  onLeave: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
  onToggleMute: () => void;
  isMuted: boolean;
  isRecording: boolean;
  onStartRecording: (title: string) => void;
  onStopRecording: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

const AudioIndicator: React.FC<{ stream: MediaStream | null; showRing?: boolean; className?: string }> = ({ stream, showRing = true, className }) => {
  const { isSpeaking, audioLevel } = useAudioLevel(stream);
  if (!showRing) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 rounded-full border-4 transition-all duration-150 pointer-events-none z-0",
        isSpeaking
          ? "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.6)]"
          : "border-transparent",
        className
      )}
      style={{
        transform: isSpeaking ? `scale(${1 + audioLevel * 0.1})` : 'scale(1)',
      }}
    />
  );
};

export const CallView: React.FC<CallViewProps> = ({
  callType,
  participants,
  localStream,
  remoteStreams,
  isCallStarter,
  onLeave,
  onEnd,
  onToggleMute,
  isMuted,
  isRecording,
  onStartRecording,
  onStopRecording,
  connectionStatus
}) => {
  const { user } = useAuth();
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const { playJoinTone, playEndTone } = useCallSounds();
  const joinTonePlayed = useRef(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Play join sound on mount once
  useEffect(() => {
    if (!joinTonePlayed.current) {
      playJoinTone();
      joinTonePlayed.current = true;
    }
  }, [playJoinTone]);

  // Track call duration when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }
    
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [connectionStatus]);

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try { await (isCallStarter ? onEnd() : onLeave()); playEndTone(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not end the call. Try again.'); }
    finally { setLeaving(false); }
  };

  // Determine if it's 1-on-1
  // We filter participants to find the "other" person.
  // A call is 1:1 if there's only 1 or 2 participants in total (including local).
  const remoteParticipants = participants.filter(p => p.user_id !== user?.id);
  const isOneOnOne = remoteParticipants.length === 1 && participants.length <= 2;
  const remoteP = remoteParticipants[0];

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <div className="text-yellow-500 flex items-center gap-1.5 font-medium animate-pulse"><Wifi className="h-3 w-3" /> Connecting...</div>;
      case 'connected':
        return (
          <div className="text-green-500 flex items-center gap-2 font-medium">
            <Wifi className="h-3 w-3" />
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatDuration(callDuration)}
            </span>
          </div>
        );
      default:
        return <div className="text-slate-400 flex items-center gap-1.5 font-medium"><WifiOff className="h-3 w-3" /> Waiting</div>;
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-background z-[100] flex flex-col overflow-hidden text-white">
      {Array.from(remoteStreams.entries()).map(([id, s]) => <RemoteAudioPlayer key={id} stream={s} />)}

      {/* 1-on-1 Phone Mode Layout */}
      {isOneOnOne && remoteP ? (
        <div className="relative flex-1 flex flex-col items-center justify-between p-6 md:p-8">
          {/* Blurred Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110 transition-all duration-1000"
              style={{ backgroundImage: `url(${remoteP.profile?.avatar_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />
          </div>

          {/* Header info */}
          <div className="relative z-10 w-full flex flex-col items-center gap-3 mt-8 md:mt-12">
            <div className="bg-white/5 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
              <div className={cn("w-2 h-2 rounded-full", connectionStatus === 'connected' ? "bg-green-500 animate-pulse" : "bg-yellow-500")} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Secure Voice Call</span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Recording Active</span>
              </div>
            )}
          </div>

          {/* Remote User Center */}
          <div className="relative z-10 flex flex-col items-center gap-6 md:gap-8">
            <div className="relative">
              <AudioIndicator
                stream={remoteStreams.get(remoteP.user_id) || remoteStreams.values().next().value || null}
                showRing={!remoteP.is_muted}
              />
              <Avatar
                name={remoteP.profile?.full_name || remoteP.profile?.username || 'User'}
                src={remoteP.profile?.avatar_url || undefined}
                className="w-32 h-32 md:w-48 md:h-48 border-4 md:border-8 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 ring-1 ring-white/10"
              />
              <div className="absolute -bottom-1 -right-1 bg-slate-900 border-2 border-slate-800 rounded-full p-2 z-20 shadow-xl">
                {remoteP.is_muted ? <MicOff className="h-4 w-4 md:h-6 md:w-6 text-red-500" /> : <Mic className="h-4 w-4 md:h-6 md:w-6 text-green-500" />}
              </div>
            </div>
            <div className="text-center space-y-1 md:space-y-2">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
                {remoteP.profile?.full_name || remoteP.profile?.username}
              </h2>
              <p className="text-slate-400 font-semibold tracking-wide text-sm md:text-lg">@{remoteP.profile?.username || 'user'}</p>
              <div className="mt-4 md:mt-6 flex justify-center">{getConnectionStatusDisplay()}</div>
            </div>
          </div>

          {/* Local PiP (Floating) */}
          <div className="absolute bottom-32 md:bottom-40 right-6 md:right-8 z-20 group">
            <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-2xl md:rounded-3xl p-1 border border-white/10 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95">
              <AudioIndicator stream={localStream} showRing={!isMuted} className="rounded-2xl md:rounded-3xl" />
              <div className="w-16 h-24 md:w-24 md:h-36 rounded-xl md:rounded-[1.25rem] overflow-hidden relative z-10 bg-slate-800/50 flex items-center justify-center border border-white/5">
                <Avatar name="You" className="w-10 h-10 md:w-16 md:h-16 shadow-2xl border-2 border-white/10" />
                <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black uppercase tracking-tighter text-white/80 border border-white/5">You</div>
              </div>
              {isMuted && (
                <div className="absolute -top-1 -left-1 bg-red-500 rounded-full p-1.5 z-20 shadow-xl border border-slate-950">
                  <MicOff className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Standard Grid Layout for Groups or Single mode */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 md:p-4 flex items-center justify-between bg-slate-900/30 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="bg-primary/20 p-2 rounded-xl md:rounded-2xl border border-primary/20">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-sm md:text-base tracking-tight">Audio Call</h2>
                <p className="text-[9px] md:text-[11px] text-slate-400 font-bold uppercase tracking-wider">{participants.length} Active</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden sm:block">{getConnectionStatusDisplay()}</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 md:h-9 px-3 md:px-4 text-[9px] md:text-[11px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg md:rounded-xl transition-all"
                onClick={() => {
                  document.querySelectorAll('audio').forEach(a => a.play().catch(() => { }));
                  toast.success('Audio system synchronized');
                }}
              >
                <Volume2 className="h-3.5 w-3.5 mr-1.5 md:mr-2" /> Resume
              </Button>
            </div>
          </div>

          <div className="flex-1 p-4 md:p-8 overflow-auto min-h-0">
            <div className={`grid gap-4 md:gap-6 h-full content-center ${remoteParticipants.length === 0 ? 'grid-cols-1 max-w-xs mx-auto' :
              participants.length <= 4 ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
              {/* Local Participant */}
              <div className="relative bg-slate-900/40 rounded-2xl md:rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center min-h-[140px] md:min-h-[220px] group transition-all hover:bg-slate-900/60 shadow-xl overflow-hidden">
                <AudioIndicator stream={localStream} showRing={!isMuted} className="rounded-2xl md:rounded-[2.5rem]" />
                <div className="relative z-10 scale-90 md:scale-110">
                  <Avatar name="You" className="w-16 h-16 md:w-24 md:h-24 border-2 md:border-4 border-slate-800 shadow-2xl" />
                </div>
                <span className="mt-3 md:mt-5 text-xs font-bold text-slate-300 relative z-10 tracking-wide">You</span>
                <div className={cn(
                  "absolute bottom-3 md:bottom-6 right-3 md:right-6 rounded-full p-1.5 md:p-2.5 transition-all shadow-lg",
                  isMuted ? "bg-red-500 text-white" : "bg-green-500 text-white"
                )}>
                  {isMuted ? <MicOff className="h-3 w-3 md:h-4 md:w-4" /> : <Mic className="h-3 w-3 md:h-4 md:w-4" />}
                </div>
              </div>

              {/* Remote Participants */}
              {remoteParticipants.map((p) => (
                <div key={p.user_id} className="relative bg-slate-900/40 rounded-2xl md:rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center min-h-[140px] md:min-h-[220px] group transition-all hover:bg-slate-900/60 shadow-xl overflow-hidden">
                  <AudioIndicator stream={remoteStreams.get(p.user_id) || null} showRing={!p.is_muted} className="rounded-2xl md:rounded-[2.5rem]" />
                  <div className="relative z-10 scale-90 md:scale-110">
                    <Avatar
                      name={p.profile?.full_name || p.profile?.username || 'User'}
                      src={p.profile?.avatar_url || undefined}
                      className="w-16 h-16 md:w-24 md:h-24 border-2 md:border-4 border-slate-800 shadow-2xl"
                    />
                  </div>
                  <span className="mt-3 md:mt-5 text-xs font-bold text-slate-300 relative z-10 tracking-wide">{p.profile?.full_name || p.profile?.username}</span>
                  <div className={cn(
                    "absolute bottom-3 md:bottom-6 right-3 md:right-6 rounded-full p-1.5 md:p-2.5 transition-all shadow-lg",
                    p.is_muted ? "bg-red-500 text-white" : "bg-green-500 text-white"
                  )}>
                    {p.is_muted ? <MicOff className="h-3 w-3 md:h-4 md:w-4" /> : <Mic className="h-3 w-3 md:h-4 md:w-4" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modern Floating Controls */}
      <div className="p-6 md:p-10 pb-8 md:pb-14 flex justify-center items-center gap-4 md:gap-8 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent relative z-[110] shrink-0">
        <Button
          variant="ghost"
          size="lg"
          className={cn(
            "rounded-full w-14 h-14 md:w-18 md:h-18 transition-all border-2 flex items-center justify-center p-0 shadow-2xl",
            isMuted
              ? "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              : "bg-slate-800/60 backdrop-blur-xl border-white/10 text-white hover:bg-slate-700"
          )}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6 md:h-8 md:w-8" /> : <Mic className="h-6 w-6 md:h-8 md:w-8" />}
        </Button>

        {isCallStarter && (
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "rounded-full w-12 h-12 md:w-16 md:h-16 transition-all border-2 flex items-center justify-center p-0 shadow-xl",
              isRecording
                ? "bg-red-500 border-red-500 text-white animate-pulse"
                : "bg-slate-800/60 backdrop-blur-xl border-white/10 text-slate-400 hover:text-white"
            )}
            aria-label={isRecording ? "Stop recording" : "Recording settings"}
            onClick={isRecording ? onStopRecording : () => { setRecordingConsent(false); setShowRecordDialog(true); }}
          >
            <Circle className={`h-5 w-5 md:h-7 md:w-7 ${isRecording ? 'fill-white' : ''}`} />
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-16 h-16 md:w-20 md:h-20 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-0 border-4 border-slate-950"
          disabled={leaving}
          aria-label={leaving ? 'Ending call' : 'End call'}
          onClick={handleLeave}
        >
          <PhoneOff className="h-7 w-7 md:h-9 md:w-9" />
        </Button>
      </div>

      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="bg-card border-border text-foreground rounded-[2rem] p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold">Start Recording</DialogTitle>
            <DialogDescription className="text-slate-400 mt-2">
              Record only with everyone’s permission. A recording indicator is shown to participants; the audio is saved when recording stops.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 md:py-6">
            <Input
              placeholder="Session Name (optional)"
              value={recordingTitle}
              onChange={(e) => setRecordingTitle(e.target.value)}
              className="bg-slate-950/50 border-white/10 text-white h-12 md:h-14 rounded-2xl px-6 focus:ring-primary/50"
            />
          </div>
          <label className="flex items-center gap-3 text-sm mb-4"><Checkbox checked={recordingConsent} onCheckedChange={value => setRecordingConsent(value === true)} />I have participants’ permission to record.</label>
          <DialogFooter className="gap-3 sm:justify-end">
            <Button variant="ghost" onClick={() => setShowRecordDialog(false)} className="text-slate-400 hover:text-white hover:bg-white/5 h-10 md:h-12 rounded-xl px-4 md:px-6">Cancel</Button>
            <Button
              disabled={!recordingConsent}
              onClick={() => { onStartRecording(recordingTitle); setShowRecordDialog(false); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 md:h-12 rounded-xl px-6 md:px-8 shadow-lg shadow-primary/20"
            >
              Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
