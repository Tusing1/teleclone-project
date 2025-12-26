import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreVertical, Paperclip, Send, Smile, Image as ImageIcon, Bookmark, Users, Radio, Settings, MessageCircle, Phone, Video, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { ChannelMessageBubble } from './ChannelMessageBubble';
import { SystemMessage } from './SystemMessage';
import { CallButton } from './CallButton';
import { CallView } from './CallView';
import { LiveStreamPreview } from './LiveStreamPreview';
import { LiveStreamView } from './LiveStreamView';
import { ChannelSettingsDialog } from './ChannelSettingsDialog';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { VoiceRecorder } from './VoiceRecorder';
import { ScheduleCallDialog } from './ScheduleCallDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useCalls } from '@/hooks/useCalls';
import { useLiveStream } from '@/hooks/useLiveStream';
import { useReactions } from '@/hooks/useReactions';
import { useVoiceMessage } from '@/hooks/useVoiceMessage';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onForwardMessage?: (message: MessageWithSender, fromSavedMessages?: boolean) => void;
  onNavigateToDiscussion?: (discussionId: string, replyToMessage?: MessageWithSender) => void;
  onRefreshConversations?: () => void;
}

export function ChatView({ conversation, onBack, onForwardMessage, onNavigateToDiscussion, onRefreshConversations }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, uploadFile, refetch } = useMessages(
    conversation.id, 
    conversation.linked_discussion_id
  );
  const { reactions, fetchReactions, toggleReaction } = useReactions(conversation.id);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<MessageWithSender | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<MessageWithSender | null>(null);
  const [editText, setEditText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showLiveStreamPreview, setShowLiveStreamPreview] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [isStreamMinimized, setIsStreamMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice message hook
  const { sendVoiceMessage, isUploading: isUploadingVoice } = useVoiceMessage({
    conversationId: conversation.id,
    onSuccess: () => {
      setIsRecordingVoice(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsRecordingVoice(false);
    },
  });

  const isSavedMessages = conversation.isSavedMessages;
  const isGroup = conversation.type === 'group';
  const isChannel = conversation.type === 'channel';
  const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
  const otherProfile = otherParticipant?.profile;
  
  // Check if current user can send messages (owner/admin for channels, anyone for groups/direct)
  const currentUserParticipant = conversation.participants.find(p => p.user_id === user?.id);
  const canSendMessages = !isChannel || currentUserParticipant?.role === 'owner' || currentUserParticipant?.role === 'admin';
  const isAdminOrOwner = currentUserParticipant?.role === 'owner' || currentUserParticipant?.role === 'admin';

  // Calls for groups
  const {
    activeCall,
    participants: callParticipants,
    isInCall,
    localStream,
    remoteStreams,
    isRecording,
    connectionStatus,
    isMuted,
    isVideoOff,
    isScreenSharing,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    startRecording,
    stopRecording
  } = useCalls(isChannel ? null : conversation.id); // Don't use for channels

  // Live stream for channels
  const {
    activeStream,
    participants: streamParticipants,
    isInStream,
    isRecording: isStreamRecording,
    handRaised,
    noiseSuppression,
    isMuted: isStreamMuted,
    startStream,
    joinStream,
    leaveStream,
    endStream,
    raiseHand,
    lowerHand,
    toggleMute: toggleStreamMute,
    unmuteParticipant,
    muteParticipant,
    toggleNoiseSuppression,
    updateStreamTitle,
    startRecording: startStreamRecording,
    stopRecording: stopStreamRecording
  } = useLiveStream(isChannel ? conversation.id : null);

  // Typing indicator
  const { typingUsers, handleTyping } = useTypingIndicator(conversation.id);

  const handleStartCall = async (type: 'voice' | 'video') => {
    if (isChannel) {
      // For channels, show the live stream preview
      setShowLiveStreamPreview(true);
    } else {
      const callId = await startCall(type);
      if (callId) {
        toast.success(`${type === 'video' ? 'Video' : 'Voice'} call started`);
      } else {
        toast.error('Failed to start call');
      }
    }
  };

  const handleStartLiveStream = async (title: string) => {
    console.log('handleStartLiveStream called with title:', title);
    setShowLiveStreamPreview(false); // Close preview immediately
    setIsStartingStream(true);
    const streamId = await startStream(title);
    setIsStartingStream(false);
    console.log('startStream returned:', streamId);
    if (streamId) {
      toast.success('Live stream started');
    } else {
      toast.error('Failed to start live stream');
    }
  };

  const handleJoinCall = async () => {
    if (isChannel && activeStream) {
      await joinStream(activeStream.id, !isAdminOrOwner); // Non-admins start muted
    } else if (activeCall) {
      await joinCall(activeCall.id, activeCall.call_type);
    }
  };

  const currentParticipant = callParticipants.find(p => p.user_id === user?.id);
  const participantMuted = currentParticipant?.is_muted ?? isMuted;
  const participantVideoOff = currentParticipant?.is_video_off ?? isVideoOff;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch reactions when messages load
  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions(messages.map(m => m.id));
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;
    
    setSending(true);
    await sendMessage(messageText.trim());
    setMessageText('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSending(true);
    const uploadedFile = await uploadFile(file);
    if (uploadedFile) {
      await sendMessage('', type, uploadedFile);
    }
    setSending(false);
    e.target.value = '';
  };

  // Handle message deletion
  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageToDelete.id);
      
      if (error) throw error;
      
      toast.success('Message deleted');
      refetch();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  // Handle message edit
  const handleEditMessage = async () => {
    if (!messageToEdit || !editText.trim()) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editText.trim() })
        .eq('id', messageToEdit.id);
      
      if (error) throw error;
      
      toast.success('Message updated');
      refetch();
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    } finally {
      setEditDialogOpen(false);
      setMessageToEdit(null);
      setEditText('');
    }
  };

  // Open delete confirmation
  const openDeleteDialog = (message: MessageWithSender) => {
    setMessageToDelete(message);
    setDeleteDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (message: MessageWithSender) => {
    setMessageToEdit(message);
    setEditText(message.content || '');
    setEditDialogOpen(true);
  };

  // Handle pin message
  const handlePinMessage = (message: MessageWithSender) => {
    toast.info('Pin feature coming soon');
  };

  // Handle reply
  const handleReply = (message: MessageWithSender) => {
    toast.info('Reply feature coming soon');
  };

  // Display name and status for header
  const displayName = isSavedMessages 
    ? 'Saved Messages' 
    : isGroup || isChannel
      ? conversation.name || 'Unnamed'
      : (otherProfile?.full_name || otherProfile?.username || 'Unknown');
  
  const statusText = isSavedMessages
    ? 'Forward messages here for safekeeping'
    : isGroup
      ? `${conversation.participants.length} members`
      : isChannel
        ? `${conversation.participants.length} subscribers`
        : (otherProfile?.is_online 
            ? 'online' 
            : otherProfile?.last_seen 
              ? `last seen ${new Date(otherProfile.last_seen).toLocaleString()}`
              : 'offline');

  // Show connecting screen while starting stream
  if (isStartingStream && isChannel) {
    return (
      <div className="fixed inset-0 bg-[#1a1a2e] z-50 flex flex-col items-center justify-center">
        <div className="animate-pulse mb-4">
          <Radio className="h-16 w-16 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Starting Live Stream...</h2>
        <p className="text-gray-400">Please allow microphone access when prompted</p>
      </div>
    );
  }

  // Show live stream preview for channels
  if (showLiveStreamPreview && isChannel) {
    return (
      <LiveStreamPreview
        channelName={conversation.name || 'Channel'}
        channelAvatar={conversation.avatar_url || undefined}
        subscriberCount={conversation.participants.length}
        onStart={handleStartLiveStream}
        onSchedule={() => {
          setShowLiveStreamPreview(false);
          setShowScheduleCall(true);
        }}
        onClose={() => setShowLiveStreamPreview(false)}
      />
    );
  }

  // Show live stream view for channels (can be minimized)
  if (isInStream && activeStream && isChannel && !isStreamMinimized) {
    return (
      <LiveStreamView
        channelName={conversation.name || 'Channel'}
        channelAvatar={conversation.avatar_url || undefined}
        participants={streamParticipants}
        isAdmin={isAdminOrOwner}
        isMuted={isStreamMuted}
        isRecording={isStreamRecording}
        streamTitle={activeStream.livestream_title || 'Live Stream'}
        currentUserId={user?.id || ''}
        onToggleMute={toggleStreamMute}
        onLeave={leaveStream}
        onEnd={endStream}
        onStartRecording={startStreamRecording}
        onStopRecording={stopStreamRecording}
        onRaiseHand={raiseHand}
        onLowerHand={lowerHand}
        onUnmuteParticipant={unmuteParticipant}
        onMuteParticipant={muteParticipant}
        onUpdateTitle={updateStreamTitle}
        handRaised={handRaised}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={toggleNoiseSuppression}
        onMinimize={() => setIsStreamMinimized(prev => !prev)}
        isMinimized={false}
      />
    );
  }

  // Show call UI if in call (for groups)
  if (isInCall && activeCall && !isChannel) {
    return (
      <CallView
        callType={activeCall.call_type}
        participants={callParticipants}
        localStream={localStream}
        remoteStreams={remoteStreams}
        isCallStarter={activeCall.started_by === user?.id}
        onLeave={leaveCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={activeCall.call_type === 'video' ? toggleScreenShare : undefined}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        connectionStatus={connectionStatus}
      />
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-full relative md:rounded-2xl md:m-2 md:shadow-lg overflow-hidden",
      isChannel ? "bg-slate-900" : "bg-chat-bg"
    )}>
      {/* Minimized Live Stream Bar */}
      {isInStream && activeStream && isChannel && isStreamMinimized && (
        <LiveStreamView
          channelName={conversation.name || 'Channel'}
          channelAvatar={conversation.avatar_url || undefined}
          participants={streamParticipants}
          isAdmin={isAdminOrOwner}
          isMuted={isStreamMuted}
          isRecording={isStreamRecording}
          streamTitle={activeStream.livestream_title || 'Live Stream'}
          currentUserId={user?.id || ''}
          onToggleMute={toggleStreamMute}
          onLeave={leaveStream}
          onEnd={endStream}
          onStartRecording={startStreamRecording}
          onStopRecording={stopStreamRecording}
          onRaiseHand={raiseHand}
          onLowerHand={lowerHand}
          onUnmuteParticipant={unmuteParticipant}
          onMuteParticipant={muteParticipant}
          onUpdateTitle={updateStreamTitle}
          handRaised={handRaised}
          noiseSuppression={noiseSuppression}
          onToggleNoiseSuppression={toggleNoiseSuppression}
          onMinimize={() => setIsStreamMinimized(false)}
          isMinimized={true}
        />
      )}
      {/* Header - add top margin when minimized stream bar is visible */}
      <div className={cn(
        "flex items-center gap-3 p-3 border-b md:rounded-t-2xl",
        isChannel ? "bg-slate-800 border-slate-700" : "bg-card border-border",
        isStreamMinimized && isInStream && "mt-14"
      )}>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className={cn(
            "md:hidden shrink-0",
            isChannel && "text-slate-300 hover:text-slate-100 hover:bg-slate-700"
          )}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {isSavedMessages ? (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-primary-foreground" />
          </div>
        ) : isGroup ? (
          <button 
            onClick={() => isAdminOrOwner && setShowGroupSettings(true)}
            className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Users className="w-5 h-5 text-white" />
          </button>
        ) : isChannel ? (
          <button 
            onClick={() => setShowChannelSettings(true)}
            className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Radio className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button onClick={() => setShowEditProfile(true)} className="cursor-pointer">
            <Avatar
              src={otherProfile?.avatar_url}
              name={displayName}
              size="sm"
              isOnline={otherProfile?.is_online}
            />
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          <h2 className={cn(
            "font-semibold truncate",
            isChannel && "text-slate-100"
          )}>{displayName}</h2>
          <p className={cn(
            'text-xs truncate',
            isChannel ? 'text-slate-400' : 
            (!isSavedMessages && !isGroup && otherProfile?.is_online ? 'text-online' : 'text-muted-foreground')
          )}>
            {statusText}
          </p>
        </div>
        
        {/* Call button for groups and channels */}
        {(isGroup || isChannel) && !isSavedMessages && (
          <CallButton
            onStartCall={handleStartCall}
            canStartCall={isAdminOrOwner}
            hasActiveCall={isChannel ? (!!activeStream && !isInStream) : (!!activeCall && !isInCall)}
            onJoinCall={handleJoinCall}
          />
        )}

        {/* Discussion button for channels with linked discussion */}
        {isChannel && conversation.linked_discussion_id && onNavigateToDiscussion && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onNavigateToDiscussion(conversation.linked_discussion_id!)}
            title="Go to discussion"
            className={isChannel ? "text-slate-300 hover:text-slate-100 hover:bg-slate-700" : ""}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        )}
        
        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className={isChannel ? "text-slate-300 hover:text-slate-100 hover:bg-slate-700" : ""}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Call options for direct chats */}
            {!isGroup && !isChannel && !isSavedMessages && (
              <>
                <DropdownMenuItem onClick={() => startCall('voice')}>
                  <Phone className="h-4 w-4 mr-2" />
                  Voice Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startCall('video')}>
                  <Video className="h-4 w-4 mr-2" />
                  Video Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEditProfile(true)}>
                  <User className="h-4 w-4 mr-2" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {isGroup && isAdminOrOwner && (
              <DropdownMenuItem onClick={() => setShowGroupSettings(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Group Settings
              </DropdownMenuItem>
            )}
            {isChannel && isAdminOrOwner && (
              <DropdownMenuItem onClick={() => setShowChannelSettings(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Channel Settings
              </DropdownMenuItem>
            )}
            {isChannel && conversation.linked_discussion_id && onNavigateToDiscussion && (
              <DropdownMenuItem onClick={() => onNavigateToDiscussion(conversation.linked_discussion_id!)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Open Discussion
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Group Settings Dialog */}
      {isGroup && (
        <GroupSettingsDialog
          open={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          group={conversation}
          isOwner={currentUserParticipant?.role === 'owner'}
          isAdmin={currentUserParticipant?.role === 'admin'}
          onRefresh={onRefreshConversations || (() => {})}
        />
      )}

      {/* Channel Settings Dialog */}
      {isChannel && (
        <ChannelSettingsDialog
          open={showChannelSettings}
          onClose={() => setShowChannelSettings(false)}
          channel={conversation}
          isOwner={currentUserParticipant?.role === 'owner'}
          onRefresh={onRefreshConversations || (() => {})}
        />
      )}

      {/* Edit Profile Dialog for direct chats */}
      {!isGroup && !isChannel && !isSavedMessages && (
        <EditProfileDialog
          open={showEditProfile}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            {isSavedMessages ? (
              <>
                <Bookmark className="w-16 h-16 mb-4 text-primary/30" />
                <p className="font-medium">Saved Messages</p>
                <p className="text-sm text-center max-w-xs mt-1">
                  Forward messages here to save them. Recorded calls will also appear here.
                </p>
              </>
            ) : (
              <>
                <p>No messages yet</p>
                <p className="text-sm">Send a message to start the conversation</p>
              </>
            )}
          </div>
        ) : (
          <div className="px-3 space-y-4">
            {messages.map((message, index) => {
              const showAvatar = index === 0 || 
                messages[index - 1].sender_id !== message.sender_id;
              
              // Render system messages (e.g., "Live Stream Started")
              if (message.message_type === 'system') {
                const hasActiveCallOrStream = isChannel ? !!activeStream : !!activeCall;
                const isNotInCallOrStream = isChannel ? !isInStream : !isInCall;
                
                return (
                  <SystemMessage
                    key={message.id}
                    content={message.content || ''}
                    timestamp={message.created_at}
                    hasActiveCall={hasActiveCallOrStream && isNotInCallOrStream}
                    onJoinCall={handleJoinCall}
                    isChannel={isChannel}
                  />
                );
              }
              
              // Use ChannelMessageBubble for channels
              if (isChannel) {
                return (
                  <ChannelMessageBubble
                    key={message.id}
                    message={message}
                    reactions={reactions[message.id] || []}
                    onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                    onOpenComments={conversation.linked_discussion_id ? () => {
                      onNavigateToDiscussion?.(conversation.linked_discussion_id!, message);
                    } : undefined}
                    onForward={onForwardMessage ? () => onForwardMessage(message) : undefined}
                    commentCount={message.commentCount || 0}
                    canForward={isAdminOrOwner}
                    onReply={() => handleReply(message)}
                    onPin={() => handlePinMessage(message)}
                    onEdit={() => openEditDialog(message)}
                    onDelete={() => openDeleteDialog(message)}
                    isAdmin={isAdminOrOwner}
                  />
                );
              }
              
              return (
                <MessageBubble 
                  key={message.id} 
                  message={message}
                  showAvatar={showAvatar}
                  onForward={onForwardMessage ? (msg) => onForwardMessage(msg, isSavedMessages) : undefined}
                  isChannelMessage={false}
                  onReply={(msg) => handleReply(msg)}
                  onEdit={(msg) => openEditDialog(msg)}
                  onDelete={(msg) => openDeleteDialog(msg)}
                  onPin={(msg) => handlePinMessage(msg)}
                  isAdmin={isAdminOrOwner}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator 
        users={typingUsers} 
        className={isChannel ? "text-slate-400" : ""}
      />

      {/* Input */}
      {canSendMessages ? (
        <div className={cn(
          "p-3 border-t md:rounded-b-2xl",
          isChannel ? "bg-slate-800 border-slate-700" : "bg-card border-border"
        )}>
          {isRecordingVoice ? (
            <VoiceRecorder
              onRecordingComplete={sendVoiceMessage}
              onCancel={() => setIsRecordingVoice(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'image')}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'file')}
              />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => imageInputRef.current?.click()}
                disabled={sending || isUploadingVoice}
                className={isChannel ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : ""}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || isUploadingVoice}
                className={isChannel ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : ""}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                placeholder={isChannel ? "Broadcast..." : isSavedMessages ? "Write a note..." : "Message"}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyDown}
                disabled={sending || isUploadingVoice}
                className={cn(
                  "flex-1 border-0 rounded-full",
                  isChannel ? "bg-slate-700/50 text-slate-100 placeholder:text-slate-400" : "bg-secondary"
                )}
              />
              {messageText.trim() ? (
                <Button 
                  size="icon"
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending || isUploadingVoice}
                  className="shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsRecordingVoice(true)}
                  disabled={sending || isUploadingVoice}
                  className={cn(
                    "shrink-0",
                    isChannel ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : ""
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </Button>
              )}
            </div>
          )}
        </div>
      ) : isChannel && conversation.linked_discussion_id ? (
        <div className="p-3 bg-slate-800 border-t border-slate-700">
          <Button 
            variant="secondary" 
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100"
            onClick={() => onNavigateToDiscussion?.(conversation.linked_discussion_id!)}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Open Discussion to Comment
          </Button>
        </div>
      ) : isChannel ? (
        <div className="p-3 bg-slate-800 border-t border-slate-700 text-center text-sm text-slate-400">
          Only admins can post to this channel
        </div>
      ) : null}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Message Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
          </DialogHeader>
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Enter new message..."
            className="mt-2"
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditMessage} disabled={!editText.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Call Dialog */}
      {isChannel && (
        <ScheduleCallDialog
          open={showScheduleCall}
          onClose={() => setShowScheduleCall(false)}
          conversationId={conversation.id}
        />
      )}
    </div>
  );
}