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
  Wifi,
  Radio
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

const WaveVisualizer: React.FC<{ level: number, isMuted: boolean }> = ({ level, isMuted }) => {
  return (
    <div className="flex items-end gap-[3px] h-6 w-16 mb-1">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-all duration-75",
            isMuted ? "bg-white/10" : "bg-primary animate-pulse"
          )}
          style={{
            height: isMuted ? '4px' : `${Math.max(4, level * 24 * (0.4 + Math.random() * 0.6))}px`,
            opacity: isMuted ? 0.2 : 0.6 + (level * 0.4),
            boxShadow: !isMuted && level > 0.1 ? `0 0 10px rgba(59, 130, 246, ${level})` : 'none'
          }}
        />
      ))}
    </div>
  );
};

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
  isStreamStarter?: boolean;
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
  const { isSpeaking, audioLevel } = useAudioLevel(stream || null);

  return (
    <div className={cn(
      "flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border transition-all duration-500",
      isSpeaking && !participant.is_muted
        ? "border-primary/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-white/10"
        : "border-white/5 shadow-none"
    )}>
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className={cn(
            "absolute -inset-1 rounded-full bg-primary/20 opacity-0 transition-opacity duration-300",
            isSpeaking && !participant.is_muted && "opacity-100 animate-pulse"
          )} />
          <Avatar
            name={participant.profile?.full_name || participant.profile?.username || 'Participant'}
            src={participant.profile?.avatar_url}
            size="md"
            className="border-2 border-transparent group-hover:border-primary/30 transition-colors"
          />
          {isSpeaking && !participant.is_muted && (
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-50" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold tracking-tight">
            {participant.profile?.full_name || participant.profile?.username || 'Participant'}
            {isLocal && <span className="text-primary/70 ml-2 font-normal">(You)</span>}
          </span>
          <div className="flex items-center gap-2">
            {participant.hand_raised ? (
              <span className="text-yellow-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Hand className="h-3 w-3" /> Hand Raised
              </span>
            ) : isSpeaking && !participant.is_muted ? (
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-primary text-[10px] uppercase font-black tracking-tighter animate-pulse flex items-center gap-1">
                  <AudioWaveform className="h-3 w-3" /> Speaking
                </span>
                <WaveVisualizer level={audioLevel} isMuted={false} />
              </div>
            ) : (
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                Listening
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {participant.is_muted ? (
          <div className="p-2 bg-red-500/10 rounded-full">
            <MicOff className="h-4 w-4 text-red-400" />
          </div>
        ) : (
          <div className={cn(
            "p-2 rounded-full transition-colors",
            isSpeaking ? "bg-primary/20" : "bg-white/5"
          )}>
            <Mic className={cn(
              "h-4 w-4 transition-all",
              isSpeaking ? "text-primary scale-110" : "text-primary/50"
            )} />
          </div>
        )}
        {isAdmin && !isLocal && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/5"
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
  onUnmuteParticipant: triggerUnmute,
  onMuteParticipant: triggerMute,
  onUpdateTitle,
  handRaised,
  noiseSuppression,
  onToggleNoiseSuppression,
  onMinimize,
  isMinimized = false,
  remoteStreams = new Map(),
  localStream = null,
  isStreamStarter = false
}) => {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(streamTitle);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [endStreamOnLeave, setEndStreamOnLeave] = useState(false);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
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

  const effectiveAdmin = isAdmin || isStreamStarter;

  const onMuteParticipant = (userId: string) => {
    if (!effectiveAdmin) return;
    triggerMute(userId);
  };

  const onUnmuteParticipant = (userId: string) => {
    if (!effectiveAdmin) return;
    triggerUnmute(userId);
  };

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
            {/* Raise Hand for non-admins who are muted */}
            {!effectiveAdmin && currentUserParticipant?.is_muted && (
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full ${handRaised ? 'bg-yellow-500' : 'bg-gray-600'}`}
                onClick={handRaised ? onLowerHand : onRaiseHand}
              >
                <Hand className="h-4 w-4 text-white" />
              </Button>
            )}
            {/* Mic toggle for admins OR unmuted participants */}
            {(effectiveAdmin || (currentUserParticipant && !currentUserParticipant.is_muted)) && (
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full ${isMuted ? 'bg-gray-600' : 'bg-primary'}`}
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
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
    <div className={cn(
      "fixed inset-0 bg-[#0a0a1a] z-50 flex flex-col overflow-hidden transition-all duration-500",
      isMinimized && "opacity-0 pointer-events-none"
    )}>
      {/* Dynamic Background Glow */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

      {renderRemoteAudio()}

      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-white/5 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
            onClick={onMinimize}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {/* Audio Autoplay Fallback */}
            <Button
              variant="outline"
              size="sm"
              className="flex bg-primary/20 hover:bg-primary/30 text-primary border-primary/50 text-[10px] font-bold h-7 md:h-8 animate-pulse px-2 md:px-3"
              onClick={() => {
                const audios = document.querySelectorAll('audio');
                audios.forEach(a => a.play().catch(() => { }));
                toast.success('Audio system refreshed');
              }}
            >
              <Volume2 className="h-3 w-3 mr-1" />
              Resume Audio
            </Button>
            <div className="relative">
              <Avatar name={channelName} src={channelAvatar} size="md" className="ring-2 ring-white/10 shadow-xl" />
              <div className="absolute -bottom-1 -right-1 p-1 bg-primary rounded-full border-2 border-[#0a0a1a]">
                <Radio className="h-3 w-3 text-white" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-white tracking-tight leading-none mb-1">{channelName}</h2>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                  {participants.length} Active Member{participants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
              <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
              <span className="text-xs font-medium">REC</span>
            </div>
          )}
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
      <div className="p-8 flex justify-center items-center gap-6 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/80 to-transparent z-10">
        {/* Speaker Toggle */}
        <div className="flex flex-col items-center gap-2 group">
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-white/5 hover:bg-white/10 border border-white/5 shadow-lg transition-transform group-active:scale-95"
          >
            <Volume2 className="h-6 w-6 text-white/70 group-hover:text-white" />
          </Button>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Speaker</span>
        </div>



        {/* Raise Hand (for non-admins who are muted) */}
        {!effectiveAdmin && currentUserParticipant?.is_muted && (
          <div className="flex flex-col items-center gap-2 group">
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                "rounded-full w-14 h-14 transition-all duration-300 shadow-xl border-2 group-active:scale-90",
                handRaised
                  ? "bg-yellow-500 border-yellow-400 hover:bg-yellow-400"
                  : "bg-white/5 hover:bg-white/10 border-white/5"
              )}
              onClick={handRaised ? onLowerHand : onRaiseHand}
            >
              <Hand className={cn("h-6 w-6", handRaised ? "text-white" : "text-white/70")} />
            </Button>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {handRaised ? 'Lower' : 'Raise'}
            </span>
          </div>
        )}

        {/* Primary Action: Mute/Unmute (for admins OR unmuted participants) */}
        {(effectiveAdmin || (currentUserParticipant && !currentUserParticipant.is_muted)) && (
          <div className="flex flex-col items-center gap-2 group">
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                "rounded-full w-16 h-16 transition-all duration-300 shadow-xl border-2 group-active:scale-90",
                isMuted
                  ? "bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
                  : "bg-primary border-primary hover:bg-primary/90"
              )}
              onClick={onToggleMute}
            >
              {isMuted ? (
                <MicOff className="h-7 w-7 text-red-500" />
              ) : (
                <Mic className="h-7 w-7 text-white" />
              )}
            </Button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>
        )}

        {/* Leave Action */}
        <div className="flex flex-col items-center gap-2 group">
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-red-600 border border-red-400/50 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all group-active:scale-95"
            onClick={() => setShowLeaveDialog(true)}
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </Button>
          <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest">Leave</span>
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
