import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Users, Circle, Wifi, WifiOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { CallParticipant } from '@/hooks/useCalls';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { RemoteAudioPlayer } from './RemoteAudioPlayer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCallSounds } from '@/hooks/useCallSounds';

interface CallViewProps {
  callType: 'voice';
  participants: CallParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isCallStarter: boolean;
  onLeave: () => void;
  onEnd: () => void;
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
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const { playJoinTone, playEndTone } = useCallSounds();
  const joinTonePlayed = useRef(false);

  // Play join sound on mount once
  useEffect(() => {
    if (!joinTonePlayed.current) {
      playJoinTone();
      joinTonePlayed.current = true;
    }
  }, [playJoinTone]);

  const handleLeave = () => {
    playEndTone();
    isCallStarter ? onEnd() : onLeave();
  };

  // Determine if it's 1-on-1
  // We filter participants to find the "other" person
  const isOneOnOne = participants.length === 2;
  const remoteP = participants.find(p => p.profile); // In 1:1, usually one has profile (remote) and one is local

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <div className="text-yellow-500 flex items-center gap-1.5 font-medium animate-pulse"><Wifi className="h-3 w-3" /> Connecting...</div>;
      case 'connected':
        return <div className="text-green-500 flex items-center gap-1.5 font-medium"><Wifi className="h-3 w-3" /> Secure Connection</div>;
      default:
        return <div className="text-slate-400 flex items-center gap-1.5 font-medium"><WifiOff className="h-3 w-3" /> Waiting</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden text-white">
      {Array.from(remoteStreams.entries()).map(([id, s]) => <RemoteAudioPlayer key={id} stream={s} />)}

      {/* 1-on-1 Phone Mode Layout */}
      {isOneOnOne && remoteP ? (
        <div className="relative flex-1 flex flex-col items-center justify-between p-8">
          {/* Blurred Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110 transition-all duration-1000"
              style={{ backgroundImage: `url(${remoteP.profile?.avatar_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />
          </div>

          {/* Header info */}
          <div className="relative z-10 w-full flex flex-col items-center gap-3 mt-12">
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
          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="relative">
              <AudioIndicator
                stream={remoteStreams.get(remoteP.user_id) || remoteStreams.values().next().value || null}
                showRing={!remoteP.is_muted}
              />
              <Avatar
                name={remoteP.profile?.full_name || remoteP.profile?.username || 'User'}
                src={remoteP.profile?.avatar_url || undefined}
                className="w-48 h-48 border-8 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 ring-1 ring-white/10"
              />
              <div className="absolute -bottom-2 -right-2 bg-slate-900 border-2 border-slate-800 rounded-full p-2.5 z-20 shadow-xl">
                {remoteP.is_muted ? <MicOff className="h-6 w-6 text-red-500" /> : <Mic className="h-6 w-6 text-green-500" />}
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
                {remoteP.profile?.full_name || remoteP.profile?.username}
              </h2>
              <p className="text-slate-400 font-semibold tracking-wide text-lg">@{remoteP.profile?.username || 'user'}</p>
              <div className="mt-6 flex justify-center">{getConnectionStatusDisplay()}</div>
            </div>
          </div>

          {/* Local PiP (Floating) */}
          <div className="absolute bottom-40 right-8 z-20 group">
            <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-3xl p-1.5 border border-white/10 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95">
              <AudioIndicator stream={localStream} showRing={!isMuted} className="rounded-3xl" />
              <div className="w-24 h-36 rounded-[1.25rem] overflow-hidden relative z-10 bg-slate-800/50 flex items-center justify-center border border-white/5">
                <Avatar name="You" className="w-16 h-16 shadow-2xl border-2 border-white/10" />
                <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter text-white/80 border border-white/5">You</div>
              </div>
              {isMuted && (
                <div className="absolute -top-1 -left-1 bg-red-500 rounded-full p-2 z-20 shadow-xl border-2 border-slate-950">
                  <MicOff className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Standard Grid Layout for Groups or Single mode */
        <div className="flex-1 flex flex-col">
          <div className="p-4 flex items-center justify-between bg-slate-900/30 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="bg-primary/20 p-2.5 rounded-2xl border border-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-base tracking-tight">Channel Audio</h2>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{participants.length} Participants</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {getConnectionStatusDisplay()}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-4 text-[11px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all"
                onClick={() => {
                  document.querySelectorAll('audio').forEach(a => a.play().catch(() => { }));
                  toast.success('Audio system synchronized');
                }}
              >
                <Volume2 className="h-4 w-4 mr-2" /> Resume Audio
              </Button>
            </div>
          </div>

          <div className="flex-1 p-8 overflow-auto">
            <div className={`grid gap-6 h-full content-center ${participants.length <= 1 ? 'grid-cols-1 max-w-md mx-auto' :
                participants.length <= 4 ? 'grid-cols-2' :
                  'grid-cols-3'
              }`}>
              {/* Local Participant */}
              <div className="relative bg-slate-900/40 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center min-h-[220px] group transition-all hover:bg-slate-900/60 shadow-xl overflow-hidden">
                <AudioIndicator stream={localStream} showRing={!isMuted} className="rounded-[2.5rem]" />
                <div className="relative z-10 scale-110">
                  <Avatar name="You" className="w-24 h-24 border-4 border-slate-800 shadow-2xl" />
                </div>
                <span className="mt-5 text-sm font-bold text-slate-300 relative z-10 tracking-wide">You</span>
                <div className={cn(
                  "absolute bottom-6 right-6 rounded-full p-2.5 transition-all shadow-lg",
                  isMuted ? "bg-red-500 text-white" : "bg-green-500 text-white"
                )}>
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </div>
              </div>

              {/* Remote Participants */}
              {participants.filter(p => p.profile).map((p) => (
                <div key={p.user_id} className="relative bg-slate-900/40 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center min-h-[220px] group transition-all hover:bg-slate-900/60 shadow-xl overflow-hidden">
                  <AudioIndicator stream={remoteStreams.get(p.user_id) || null} showRing={!p.is_muted} className="rounded-[2.5rem]" />
                  <div className="relative z-10 scale-110">
                    <Avatar
                      name={p.profile?.full_name || p.profile?.username || 'User'}
                      src={p.profile?.avatar_url || undefined}
                      className="w-24 h-24 border-4 border-slate-800 shadow-2xl"
                    />
                  </div>
                  <span className="mt-5 text-sm font-bold text-slate-300 relative z-10 tracking-wide">{p.profile?.full_name || p.profile?.username}</span>
                  <div className={cn(
                    "absolute bottom-6 right-6 rounded-full p-2.5 transition-all shadow-lg",
                    p.is_muted ? "bg-red-500 text-white" : "bg-green-500 text-white"
                  )}>
                    {p.is_muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modern Floating Controls */}
      <div className="p-10 pb-14 flex justify-center items-center gap-8 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent relative z-[110]">
        <Button
          variant="ghost"
          size="lg"
          className={cn(
            "rounded-full w-18 h-18 transition-all border-2 flex items-center justify-center p-0 shadow-2xl",
            isMuted
              ? "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              : "bg-slate-800/60 backdrop-blur-xl border-white/10 text-white hover:bg-slate-700"
          )}
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </Button>

        {isCallStarter && (
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "rounded-full w-16 h-16 transition-all border-2 flex items-center justify-center p-0 shadow-xl",
              isRecording
                ? "bg-red-500 border-red-500 text-white animate-pulse"
                : "bg-slate-800/60 backdrop-blur-xl border-white/10 text-slate-400 hover:text-white"
            )}
            onClick={isRecording ? onStopRecording : () => setShowRecordDialog(true)}
          >
            <Circle className={`h-7 w-7 ${isRecording ? 'fill-white' : ''}`} />
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-20 h-20 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-0 border-4 border-slate-950"
          onClick={handleLeave}
        >
          <PhoneOff className="h-9 w-9" />
        </Button>
      </div>

      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Start Recording</DialogTitle>
            <DialogDescription className="text-slate-400 mt-2">
              The conversation will be saved as an audio file. All participants will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Input
              placeholder="Session Name (optional)"
              value={recordingTitle}
              onChange={(e) => setRecordingTitle(e.target.value)}
              className="bg-slate-950/50 border-white/10 text-white h-14 rounded-2xl px-6 focus:ring-primary/50"
            />
          </div>
          <DialogFooter className="gap-3 sm:justify-end">
            <Button variant="ghost" onClick={() => setShowRecordDialog(false)} className="text-slate-400 hover:text-white hover:bg-white/5 h-12 rounded-xl px-6">Cancel</Button>
            <Button
              onClick={() => { onStartRecording(recordingTitle); setShowRecordDialog(false); }}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
