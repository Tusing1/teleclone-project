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

// Audio level indicator component
const AudioIndicator: React.FC<{ stream: MediaStream | null; showRing?: boolean }> = ({ stream, showRing = true }) => {
  const { isSpeaking, audioLevel } = useAudioLevel(stream);

  if (!showRing) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 rounded-xl border-4 transition-all duration-150 pointer-events-none",
        isSpeaking
          ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
          : "border-transparent"
      )}
      style={{
        transform: isSpeaking ? `scale(${1 + audioLevel * 0.05})` : 'scale(1)',
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');

  // Audio level for local stream
  const { isSpeaking: localIsSpeaking } = useAudioLevel(localStream);

  // Play remote video streams
  useEffect(() => {
    remoteStreams.forEach((stream, oderId) => {
      const videoEl = remoteVideoRefs.current.get(oderId);
      if (videoEl && stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const handleStartRecording = () => {
    onStartRecording(recordingTitle);
    setShowRecordDialog(false);
    setRecordingTitle('');
  };

  const setRemoteVideoRef = (oderId: string) => (el: HTMLVideoElement | null) => {
    if (el) {
      remoteVideoRefs.current.set(oderId, el);
      const stream = remoteStreams.get(oderId);
      if (stream) {
        el.srcObject = stream;
      }
    } else {
      remoteVideoRefs.current.delete(oderId);
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-yellow-500">
            <Wifi className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Connecting...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-500">
            <Wifi className="h-4 w-4" />
            <span className="text-sm">Connected</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm">Waiting for peers</span>
          </div>
        );
    }
  };

  const renderRemoteAudio = () => {
    return Array.from(remoteStreams.entries()).map(([streamId, stream]) => (
      <RemoteAudioPlayer key={streamId} stream={stream} />
    ));
  };

  // Get participants excluding current user for remote display
  const remoteParticipants = participants.filter(p => p.profile);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {renderRemoteAudio()}
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <span className="font-medium">{participants.length} participant(s)</span>
        </div>
        <div className="flex items-center gap-4">
          {getConnectionStatusDisplay()}
          {isRecording && (
            <div className="flex items-center gap-1 text-red-500">
              <Circle className="h-3 w-3 fill-red-500 animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex bg-primary/20 hover:bg-primary/30 text-primary border-primary/50 text-[10px] font-bold h-7 animate-pulse px-2"
            onClick={() => {
              const audios = document.querySelectorAll('audio');
              audios.forEach(a => a.play().catch(() => { }));
              toast.success('Audio system refreshed');
            }}
          >
            <Volume2 className="h-3 w-3 mr-1" />
            Resume Audio
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              "w-2 h-2 rounded-full",
              connectionStatus === 'connected' ? "bg-green-500 animate-pulse" : "bg-yellow-500"
            )} />
            Voice Call
          </div>
        </div>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={`grid gap-4 h-full ${participants.length === 1 ? 'grid-cols-1' :
          participants.length <= 4 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
          {/* Local video/avatar */}
          <div className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
            {/* Audio level indicator ring */}
            <AudioIndicator stream={localStream} showRing={!isMuted} />

            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "relative transition-all duration-150",
                localIsSpeaking && !isMuted && "scale-110"
              )}>
                <Avatar name="You" size="lg" />
                {localIsSpeaking && !isMuted && (
                  <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-ping opacity-75" />
                )}
              </div>
              <span className="text-sm font-medium">You</span>
            </div>

            {/* Mute indicator with animation */}
            <div className={cn(
              "absolute bottom-2 right-2 rounded-full p-1.5 transition-all duration-300",
              isMuted
                ? "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                : "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
            )}>
              {isMuted ? (
                <MicOff className="h-4 w-4 text-white" />
              ) : (
                <Mic className="h-4 w-4 text-white" />
              )}
            </div>

            <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs text-white">
              You
            </div>
          </div>

          {/* Remote participants with streams */}
          {Array.from(remoteStreams.entries()).map(([streamId, stream]) => {
            const participant = remoteParticipants[0]; // For 1:1 calls

            return (
              <div
                key={streamId}
                className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]"
              >
                {/* Audio level indicator ring */}
                <AudioIndicator stream={stream} showRing={!participant?.is_muted} />

                <div className="flex flex-col items-center gap-2">
                  <Avatar
                    name={participant?.profile?.full_name || participant?.profile?.username || 'Remote'}
                    src={participant?.profile?.avatar_url || undefined}
                    size="lg"
                  />
                  <span className="text-sm font-medium">
                    {participant?.profile?.full_name || participant?.profile?.username || 'Remote User'}
                  </span>
                </div>

                {/* Mute indicator with animation */}
                <div className={cn(
                  "absolute bottom-2 right-2 rounded-full p-1.5 transition-all duration-300",
                  participant?.is_muted
                    ? "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    : "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                )}>
                  {participant?.is_muted ? (
                    <MicOff className="h-4 w-4 text-white" />
                  ) : (
                    <Mic className="h-4 w-4 text-white" />
                  )}
                </div>

                <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs text-white flex items-center gap-1">
                  {participant?.profile?.username || 'Remote'}
                  <Wifi className="h-3 w-3 text-green-400" />
                </div>
              </div>
            );
          })}

          {/* Show avatars for participants without streams yet */}
          {remoteStreams.size === 0 && remoteParticipants.map((participant) => (
            <div
              key={participant.id}
              className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]"
            >
              <div className="flex flex-col items-center gap-2">
                <Avatar
                  name={participant.profile?.full_name || participant.profile?.username || ''}
                  src={participant.profile?.avatar_url || undefined}
                  size="lg"
                />
                <span className="text-sm font-medium">
                  {participant.profile?.full_name || participant.profile?.username}
                </span>
                {connectionStatus === 'connecting' && (
                  <span className="text-xs text-muted-foreground animate-pulse">Connecting...</span>
                )}
              </div>

              {/* Mute indicator */}
              <div className={cn(
                "absolute bottom-2 right-2 rounded-full p-1.5 transition-all duration-300",
                participant.is_muted
                  ? "bg-red-500 animate-pulse"
                  : "bg-green-500"
              )}>
                {participant.is_muted ? (
                  <MicOff className="h-4 w-4 text-white" />
                ) : (
                  <Mic className="h-4 w-4 text-white" />
                )}
              </div>

              <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs text-white">
                {participant.profile?.username}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 flex justify-center gap-4 border-t bg-background">
        {/* Mute button with animated states */}
        <Button
          variant="ghost"
          size="lg"
          className={cn(
            "rounded-full w-14 h-14 transition-all duration-300 border-2",
            isMuted
              ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              : "bg-green-500/20 border-green-500 text-green-500 hover:bg-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          )}
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {/* Recording button - only for call starter */}
        {isCallStarter && (
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "rounded-full w-14 h-14 transition-all duration-300 border-2",
              isRecording
                ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                : "bg-secondary border-border text-foreground hover:bg-secondary/80"
            )}
            onClick={isRecording ? onStopRecording : () => setShowRecordDialog(true)}
          >
            <Circle className={`h-6 w-6 ${isRecording ? 'fill-red-500' : ''}`} />
          </Button>
        )}

        {/* End call button */}
        <Button
          variant="ghost"
          size="lg"
          className="rounded-full w-14 h-14 bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(239,68,68,0.7)]"
          onClick={isCallStarter ? onEnd : onLeave}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Start Recording Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start recording</DialogTitle>
            <DialogDescription>
              Do you want to start recording this chat and save the result into an audio file?
              Other members will see the chat is being recorded.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Recording Title"
            value={recordingTitle}
            onChange={(e) => setRecordingTitle(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRecordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartRecording}>
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
