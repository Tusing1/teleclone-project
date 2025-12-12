import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { CallParticipant } from '@/hooks/useCalls';

interface CallViewProps {
  callType: 'voice' | 'video';
  participants: CallParticipant[];
  localStream: MediaStream | null;
  isCallStarter: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
}

export const CallView: React.FC<CallViewProps> = ({
  callType,
  participants,
  localStream,
  isCallStarter,
  onLeave,
  onEnd,
  onToggleMute,
  onToggleVideo,
  isMuted,
  isVideoOff
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <span className="font-medium">{participants.length} participant(s)</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          {callType === 'video' ? 'Video Call' : 'Voice Call'}
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
            {callType === 'video' && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
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

          {/* Other participants */}
          {participants.filter(p => p.profile).map((participant) => (
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

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={isCallStarter ? onEnd : onLeave}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};
