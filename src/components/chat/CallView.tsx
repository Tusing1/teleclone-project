import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Circle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { CallParticipant } from '@/hooks/useCalls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface CallViewProps {
  callType: 'voice' | 'video';
  participants: CallParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isCallStarter: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  isRecording: boolean;
  onStartRecording: (title: string) => void;
  onStopRecording: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

export const CallView: React.FC<CallViewProps> = ({
  callType,
  participants,
  localStream,
  remoteStreams,
  isCallStarter,
  onLeave,
  onEnd,
  onToggleMute,
  onToggleVideo,
  isMuted,
  isVideoOff,
  isRecording,
  onStartRecording,
  onStopRecording,
  connectionStatus
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');

  // Play local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream && !isVideoOff) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff]);

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

  // Get participants excluding current user for remote display
  const remoteParticipants = participants.filter(p => p.profile);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </div>
        </div>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={`grid gap-4 h-full ${
          participants.length === 1 ? 'grid-cols-1' :
          participants.length <= 4 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {/* Local video/avatar */}
          <div className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
            {callType === 'video' && !isVideoOff && localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Avatar name="You" size="lg" />
                <span className="text-sm font-medium">You</span>
              </div>
            )}
            {isMuted && (
              <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1">
                <MicOff className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs text-white">
              You
            </div>
          </div>

          {/* Remote participants */}
          {Array.from(remoteStreams.entries()).map(([streamId, stream]) => {
            const participant = remoteParticipants[0]; // For 1:1 calls
            const showVideo = callType === 'video' && stream;

            return (
              <div 
                key={streamId} 
                className="relative bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]"
              >
                {showVideo ? (
                  <video
                    ref={setRemoteVideoRef(streamId)}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
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
                )}
                {participant?.is_muted && (
                  <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1">
                    <MicOff className="h-4 w-4 text-white" />
                  </div>
                )}
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
                  <span className="text-xs text-muted-foreground">Connecting...</span>
                )}
              </div>
              {participant.is_muted && (
                <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1">
                  <MicOff className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-xs text-white">
                {participant.profile?.username}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 flex justify-center gap-4 border-t bg-background">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {callType === 'video' && (
          <Button
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={onToggleVideo}
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
        )}

        {/* Recording button - only for call starter */}
        {isCallStarter && (
          <Button
            variant={isRecording ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={isRecording ? onStopRecording : () => setShowRecordDialog(true)}
          >
            <Circle className={`h-6 w-6 ${isRecording ? 'fill-white' : ''}`} />
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14"
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
