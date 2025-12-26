import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Volume2,
  VideoOff,
  MicOff,
  Mic,
  PhoneOff,
  MoreVertical,
  Monitor,
  Hand,
  Circle,
  Edit2,
  Link,
  XCircle,
  AudioWaveform,
  Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { CallParticipant } from '@/hooks/useCalls';
import { RemoteAudioPlayer } from './RemoteAudioPlayer';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface LiveStreamViewProps {
  channelName: string;
  channelAvatar?: string;
  participants: CallParticipant[];
  isAdmin: boolean;
  isMuted: boolean;
  isRecording: boolean;
  streamTitle: string;
  currentUserId: string;
  onToggleMute: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onStartRecording: (title: string) => void;
  onStopRecording: () => void;
  onRaiseHand: () => void;
  onLowerHand: () => void;
  onUnmuteParticipant: (userId: string) => void;
  onMuteParticipant: (userId: string) => void;
  onUpdateTitle: (title: string) => void;
  handRaised: boolean;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  remoteStreams?: Map<string, MediaStream>;
  localStream?: MediaStream | null;
}

interface ParticipantRowProps {
  participant: CallParticipant;
  isAdmin: boolean;
  isLocal: boolean;
  stream?: MediaStream | null;
  onMuteParticipant: (userId: string) => void;
  onUnmuteParticipant: (userId: string) => void;
}

const ParticipantRow: React.FC<ParticipantRowProps> = ({
  participant,
  isAdmin,
  isLocal,
  stream,
  onMuteParticipant,
  onUnmuteParticipant
}) => {
  const { isSpeaking } = useAudioLevel(stream || null);

  return (
    <div className={cn(
      "flex items-center justify-between p-3 bg-[#2a2a4e] rounded-lg border transition-all duration-300",
      isSpeaking && !participant.is_muted ? "border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-[#3a3a5e]"
    )}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar
            name={participant.profile?.full_name || participant.profile?.username || 'Participant'}
            src={participant.profile?.avatar_url}
            size="sm"
          />
          {isSpeaking && !participant.is_muted && (
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-white font-medium">
            {participant.profile?.full_name || participant.profile?.username || 'Participant'}
            {isLocal && " (You)"}
          </span>
          {participant.hand_raised && (
            <span className="text-yellow-500 text-xs flex items-center gap-1">
              <Hand className="h-3 w-3" /> Raised Hand
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {participant.is_muted ? (
          <MicOff className="h-5 w-5 text-gray-500" />
        ) : (
          <Mic className={cn(
            "h-5 w-5",
            isSpeaking ? "text-primary animate-pulse" : "text-primary/70"
          )} />
        )}
        {isAdmin && !isLocal && (
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={() => participant.is_muted
              ? onUnmuteParticipant(participant.user_id)
              : onMuteParticipant(participant.user_id)
            }
          >
            {participant.is_muted ? 'Unmute' : 'Mute'}
          </Button>
        )}
      </div>
    </div>
  );
};

export const LiveStreamView: React.FC<LiveStreamViewProps> = ({
  channelName,
  channelAvatar,
  participants,
  isAdmin,
  isMuted,
  isRecording,
  streamTitle,
  currentUserId,
  onToggleMute,
  onLeave,
  onEnd,
  onStartRecording,
  onStopRecording,
  onRaiseHand,
  onLowerHand,
  onUnmuteParticipant,
  onMuteParticipant,
  onUpdateTitle,
  handRaised,
  noiseSuppression,
  onToggleNoiseSuppression,
  onMinimize,
  isMinimized = false,
  remoteStreams = new Map(),
  localStream = null
}) => {
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [endStreamOnLeave, setEndStreamOnLeave] = useState(false);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(streamTitle);
  const [showScreenShare, setShowScreenShare] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkEnhancement, setNetworkEnhancement] = useState(false);

  useEffect(() => {
    setNewTitle(streamTitle);
  }, [streamTitle]);

  const handleLeave = () => {
    if (endStreamOnLeave) {
      onEnd();
    } else {
      onLeave();
    }
    setShowLeaveDialog(false);
  };

  const handleStartRecording = () => {
    onStartRecording(recordingTitle);
    setShowRecordDialog(false);
    setRecordingTitle('');
  };

  const handleUpdateTitle = () => {
    onUpdateTitle(newTitle);
    setShowTitleDialog(false);
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        setIsScreenSharing(false);
        toast.success('Screen sharing stopped');
      } else {
        await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      }
    } catch (error) {
      toast.error('Failed to share screen');
    }
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Invite link copied!');
  };

  // Separate current user from others
  const currentUserParticipant = participants.find(p => p.user_id === currentUserId);
  const otherParticipants = participants.filter(p => p.user_id !== currentUserId);
  const raisedHands = participants.filter(p => p.hand_raised);

  const renderRemoteAudio = () => {
    return Array.from(remoteStreams.entries()).map(([userId, stream]) => (
      <RemoteAudioPlayer key={userId} stream={stream} />
    ));
  };

  // Minimized view - floating bar at the top
  if (isMinimized) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-[#1a1a2e] z-40 shadow-lg border-b border-[#3a3a5e]">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
                <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
                <span className="text-xs font-medium">REC</span>
              </div>
            )}
            <Avatar name={channelName} src={channelAvatar} size="sm" />
            <div>
              <p className="text-sm font-medium text-white">{streamTitle}</p>
              <p className="text-xs text-gray-400">{participants.length} listening</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full ${isMuted ? 'bg-gray-600' : 'bg-primary'}`}
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full ${handRaised ? 'bg-yellow-500' : 'bg-gray-600'}`}
                onClick={handRaised ? onLowerHand : onRaiseHand}
              >
                <Hand className="h-4 w-4 text-white" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={onMinimize}
            >
              Expand
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="bg-red-500 hover:bg-red-500/80"
              onClick={() => setShowLeaveDialog(true)}
            >
              <PhoneOff className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>

        {/* Leave Dialog for minimized view */}
        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent className="bg-[#2a2a4e] border-[#3a3a5e]">
            <DialogHeader>
              <DialogTitle className="text-white">Leave live stream</DialogTitle>
              <DialogDescription className="text-gray-400">
                Do you want to leave this live stream?
              </DialogDescription>
            </DialogHeader>
            {isAdmin && (
              <div className="flex items-center space-x-2 py-4">
                <Checkbox
                  id="end-stream-minimized"
                  checked={endStreamOnLeave}
                  onCheckedChange={(checked) => setEndStreamOnLeave(checked as boolean)}
                />
                <label htmlFor="end-stream-minimized" className="text-sm text-gray-300">
                  End stream for everyone
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowLeaveDialog(false)} className="text-white">
                Cancel
              </Button>
              <Button
                onClick={handleLeave}
                className={endStreamOnLeave ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                {endStreamOnLeave ? 'End Stream' : 'Leave'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {renderRemoteAudio()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] z-50 flex flex-col">
      {renderRemoteAudio()}
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-[#1a1a2e]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={onMinimize}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar name={channelName} src={channelAvatar} size="md" />
          <div>
            <h2 className="font-semibold text-white">{channelName}</h2>
            <p className="text-xs text-gray-400">{participants.length} listening</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
              <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
              <span className="text-xs font-medium">REC</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="text-white">
            <Monitor className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[#2a2a4e] border-[#3a3a5e]">
              {/* Display as */}
              <DropdownMenuItem className="flex items-center gap-3 py-3">
                <Avatar name={channelName} src={channelAvatar} size="sm" />
                <div>
                  <p className="font-medium text-white">Display me as...</p>
                  <p className="text-xs text-gray-400">{channelName}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3a3a5e]" />

              {/* Audio */}
              <DropdownMenuItem className="flex items-center gap-3 py-3">
                <Volume2 className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-white">Audio</p>
                  <p className="text-xs text-gray-400">Speaker</p>
                </div>
              </DropdownMenuItem>

              {/* Noise Suppression */}
              <DropdownMenuItem
                className="flex items-center justify-between py-3"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-3">
                  <AudioWaveform className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-white">Noise suppression</p>
                    <p className="text-xs text-gray-400">{noiseSuppression ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
                <Switch
                  checked={noiseSuppression}
                  onCheckedChange={onToggleNoiseSuppression}
                />
              </DropdownMenuItem>

              {/* Network Enhancement */}
              <DropdownMenuItem
                className="flex items-center justify-between py-3"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-3">
                  <Wifi className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-white">Network enhancement</p>
                    <p className="text-xs text-gray-400">{networkEnhancement ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
                <Switch
                  checked={networkEnhancement}
                  onCheckedChange={setNetworkEnhancement}
                />
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#3a3a5e]" />

              {/* Edit Title - Admin only */}
              {isAdmin && (
                <DropdownMenuItem
                  className="flex items-center gap-3 py-3"
                  onSelect={() => setShowTitleDialog(true)}
                >
                  <Edit2 className="h-5 w-5 text-gray-400" />
                  <p className="font-medium text-white">Edit live stream title</p>
                </DropdownMenuItem>
              )}

              {/* Share Invite Link */}
              <DropdownMenuItem
                className="flex items-center gap-3 py-3"
                onSelect={handleCopyInviteLink}
              >
                <Link className="h-5 w-5 text-gray-400" />
                <p className="font-medium text-white">Share invite link</p>
              </DropdownMenuItem>

              {/* Screen Share - Admin only */}
              {isAdmin && (
                <DropdownMenuItem
                  className="flex items-center gap-3 py-3"
                  onSelect={handleScreenShare}
                >
                  <Monitor className="h-5 w-5 text-gray-400" />
                  <p className="font-medium text-white">
                    {isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                  </p>
                </DropdownMenuItem>
              )}

              {/* Recording - Admin only */}
              {isAdmin && (
                <DropdownMenuItem
                  className="flex items-center gap-3 py-3"
                  onSelect={() => isRecording ? onStopRecording() : setShowRecordDialog(true)}
                >
                  <Circle className={`h-5 w-5 ${isRecording ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  <p className="font-medium text-white">
                    {isRecording ? 'Stop recording' : 'Start recording'}
                  </p>
                </DropdownMenuItem>
              )}

              {/* End Stream - Admin only */}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator className="bg-[#3a3a5e]" />
                  <DropdownMenuItem
                    className="flex items-center gap-3 py-3 text-red-500"
                    onSelect={onEnd}
                  >
                    <XCircle className="h-5 w-5" />
                    <p className="font-medium">End live stream</p>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stream Title */}
      <div className="px-4 py-2">
        <h3 className="text-lg font-semibold text-white">{streamTitle}</h3>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-auto px-4">
        <div className="bg-[#2a2a4e] rounded-xl divide-y divide-[#3a3a5e]">
          {/* Current User */}
          {currentUserParticipant && (
            <ParticipantRow
              participant={currentUserParticipant}
              isAdmin={isAdmin}
              isLocal={true}
              stream={localStream}
              onMuteParticipant={onMuteParticipant}
              onUnmuteParticipant={onUnmuteParticipant}
            />
          )}

          {/* Other Participants */}
          {otherParticipants.map((participant) => (
            <ParticipantRow
              key={participant.user_id}
              participant={participant}
              isAdmin={isAdmin}
              isLocal={false}
              stream={remoteStreams.get(participant.user_id)}
              onMuteParticipant={onMuteParticipant}
              onUnmuteParticipant={onUnmuteParticipant}
            />
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 flex justify-center gap-4 bg-gradient-to-t from-[#1a1a2e] to-transparent">
        {/* Speaker */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-[#3b82f6] hover:bg-[#3b82f6]/80"
          >
            <Volume2 className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xs text-gray-400">Speaker</span>
        </div>

        {/* Camera/Video Off */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-[#3b82f6] hover:bg-[#3b82f6]/80"
          >
            <VideoOff className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xs text-gray-400">Camera</span>
        </div>

        {/* Mute/Unmute or Raise Hand */}
        <div className="flex flex-col items-center gap-1">
          {isAdmin ? (
            <Button
              variant="ghost"
              size="lg"
              className={`rounded-full w-14 h-14 ${isMuted
                ? 'bg-[#3b82f6] hover:bg-[#3b82f6]/80'
                : 'bg-[#3b82f6] hover:bg-[#3b82f6]/80'
                }`}
              onClick={onToggleMute}
            >
              {isMuted ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-white" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              className={`rounded-full w-14 h-14 ${handRaised
                ? 'bg-yellow-500 hover:bg-yellow-500/80'
                : 'bg-[#3b82f6] hover:bg-[#3b82f6]/80'
                }`}
              onClick={handRaised ? onLowerHand : onRaiseHand}
            >
              <Hand className="h-6 w-6 text-white" />
            </Button>
          )}
          <span className="text-xs text-gray-400">
            {isAdmin ? (isMuted ? 'Unmute' : 'Mute') : (handRaised ? 'Lower' : 'Raise')}
          </span>
        </div>

        {/* Leave */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-500/80"
            onClick={() => setShowLeaveDialog(true)}
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </Button>
          <span className="text-xs text-gray-400">Leave</span>
        </div>
      </div>

      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="bg-[#2a2a4e] border-[#3a3a5e]">
          <DialogHeader>
            <DialogTitle className="text-white">Leave live stream</DialogTitle>
            <DialogDescription className="text-gray-400">
              Do you want to leave this live stream?
            </DialogDescription>
          </DialogHeader>
          {isAdmin && (
            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="end-stream"
                checked={endStreamOnLeave}
                onCheckedChange={(checked) => setEndStreamOnLeave(checked as boolean)}
              />
              <label htmlFor="end-stream" className="text-sm text-white cursor-pointer">
                End live stream
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLeaveDialog(false)} className="text-gray-400">
              Cancel
            </Button>
            <Button onClick={handleLeave} className="text-red-500 hover:text-red-400">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recording Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="bg-[#2a2a4e] border-[#3a3a5e]">
          <DialogHeader>
            <DialogTitle className="text-white">Start Recording</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter a title for this recording. Other members will see that the stream is being recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white">Recording Title</Label>
            <Input
              value={recordingTitle}
              onChange={(e) => setRecordingTitle(e.target.value)}
              placeholder="Enter recording title"
              className="bg-[#1a1a2e] border-[#3a3a5e] text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRecordDialog(false)} className="text-gray-400">
              Cancel
            </Button>
            <Button onClick={handleStartRecording}>Start Recording</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Title Dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="bg-[#2a2a4e] border-[#3a3a5e]">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Stream Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white">Title</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter stream title"
              className="bg-[#1a1a2e] border-[#3a3a5e] text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTitleDialog(false)} className="text-gray-400">
              Cancel
            </Button>
            <Button onClick={handleUpdateTitle}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
