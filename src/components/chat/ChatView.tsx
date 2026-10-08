import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { ArrowLeft, MoreVertical, Paperclip, Send, Smile, ImagePlus, Mic, Users, Radio, Settings, MessageCircle, Phone, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { EditMessageDialog } from './EditMessageDialog';
import { MessageBubble } from './MessageBubble';
import { ChannelMessageBubble } from './ChannelMessageBubble';
import { SystemMessage } from './SystemMessage';
import { CallButton } from './CallButton';
const CallView = lazy(() => import('./CallView').then(module => ({ default: module.CallView })));
const LiveStreamPreview = lazy(() => import('./LiveStreamPreview').then(module => ({ default: module.LiveStreamPreview })));
const LiveStreamView = lazy(() => import('./LiveStreamView').then(module => ({ default: module.LiveStreamView })));
import { ChannelSettingsDialog } from './ChannelSettingsDialog';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { VoiceRecorder } from './VoiceRecorder';
import { ScheduleCallDialog } from './ScheduleCallDialog';
const EditProfileDialog = lazy(() => import('./EditProfileDialog').then(module => ({ default: module.EditProfileDialog })));
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

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onForwardMessage?: (message: MessageWithSender) => void;
  onNavigateToDiscussion?: (discussionId: string, replyToMessage?: MessageWithSender) => void;
  onRefreshConversations?: () => void;
  onOpenBrowser?: (url: string) => void;
}

export function ChatView({
  conversation,
  onBack,
  onForwardMessage,
  onNavigateToDiscussion,
  onRefreshConversations,
  onOpenBrowser
}: ChatViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { messages, loading, error: messagesError, sendMessage, uploadFile, updateMessage, refetch, loadOlder, hasOlder, loadingOlder } = useMessages(
    conversation.id,
    conversation.linked_discussion_id,
    conversation.type === 'direct' ? conversation.participants.find(p => p.user_id !== user?.id)?.user_id : undefined,
    null,
    conversation.type !== 'channel' || conversation.participants.some(p => p.user_id === user?.id && ['admin', 'owner'].includes(p.role))
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
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showLiveStreamPreview, setShowLiveStreamPreview] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [isStreamMinimized, setIsStreamMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const historyScroll = useRef<number | null>(null);
  const lastMessageId = useRef<string | null>(null);
  useEffect(() => { lastMessageId.current = null; historyScroll.current = null; }, [conversation.id]);
  const showOlder = () => {
    historyScroll.current = scrollContainer.current?.scrollHeight || null;
    void loadOlder();
  };
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
    localStream: useCallsLocalStream,
    remoteStreams: useCallsRemoteStreams,
    isRecording: isCallRecording,
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
  } = useCalls(isChannel || isGroup ? null : conversation.id); // Don't use for channels

  const location = useLocation();

  // Live stream for channels
  const {
    activeStream,
    participants: streamParticipants,
    isInStream,
    localStream: useLiveStreamLocalStream,
    remoteStreams,
    isRecording: isStreamRecording,
    handRaised,
    noiseSuppression,
    isMuted: isStreamMuted,
    connectionStatus: streamConnectionStatus,
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
  } = useLiveStream(isChannel || isGroup ? conversation.id : null);

  const acceptedCall = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as { autoJoin?: boolean; callId?: string } | null;
    const room = isChannel || isGroup;
    const activeId = room ? activeStream?.id : activeCall?.id;
    if (!state?.autoJoin || !state.callId || activeId !== state.callId || acceptedCall.current === state.callId) return;
    acceptedCall.current = state.callId;
    const joining = room ? joinStream(state.callId, !isAdminOrOwner) : joinCall(state.callId, 'voice');
    void joining.catch(error => toast.error(error instanceof Error ? error.message : 'Could not join the call.'));
  }, [location.state, activeCall?.id, activeStream?.id, isChannel, isGroup, isAdminOrOwner, joinStream, joinCall]);

  // Typing indicator
  const { typingUsers, handleTyping } = useTypingIndicator(conversation.id);

  const handleStartCall = async () => {
    if (isChannel || isGroup) {
      // For rooms, show the live stream preview
      setShowLiveStreamPreview(true);
    } else {
      try {
        const callId = await startCall('voice');
        if (callId) toast.success('Voice call started');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not start the call.');
      }
    }
  };

  const handleStartLiveStream = async (title: string) => {
    console.log('handleStartLiveStream called with title:', title);
    setShowLiveStreamPreview(false); // Close preview immediately
    setIsStartingStream(true);
    let streamId: string | null = null;
    try { streamId = await startStream(title); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start the session.'); }
    finally { setIsStartingStream(false); }
    console.log('startStream returned:', streamId);
    if (streamId) {
      toast.success('Live stream started');
    }
  };

  const handleJoinCall = async () => {
    try {
      if ((isChannel || isGroup) && activeStream) {
        await joinStream(activeStream.id, !isAdminOrOwner); // Non-admins start muted
      } else if (activeCall) {
        await joinCall(activeCall.id, activeCall.call_type);
      }
    } catch (error) {
      console.error('Error in handleJoinCall:', error);
      toast.error(error instanceof Error ? error.message : 'Could not join the call. Check microphone permission and your connection.');
    }
  };

  const currentParticipant = callParticipants.find(p => p.user_id === user?.id);
  const participantMuted = currentParticipant?.is_muted ?? isMuted;
  const participantVideoOff = currentParticipant?.is_video_off ?? isVideoOff;

  useEffect(() => {
    const container = scrollContainer.current;
    if (historyScroll.current !== null && !loadingOlder && container) {
      container.scrollTop += container.scrollHeight - historyScroll.current;
      historyScroll.current = null;
    } else if (historyScroll.current === null) {
      const newestId = messages[messages.length - 1]?.id || null;
      const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 160;
      if (newestId !== lastMessageId.current && (nearBottom || !lastMessageId.current)) messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      lastMessageId.current = newestId;
    }
  }, [messages, loadingOlder]);

  // Fetch reactions when messages load
  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions(messages.map(m => m.id));
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!canSendMessages || !messageText.trim() || sending) return;

    setSending(true);
    const replyPrefix = replyingTo && !isChannel
      ? `↪ ${replyingTo.sender?.full_name || replyingTo.sender?.username || 'Message'}: ${replyingTo.content || 'Attachment'}\n`
      : '';
    await sendMessage(
      `${replyPrefix}${messageText.trim()}`,
      'text',
      undefined,
      isChannel ? replyingTo?.id : undefined
    );
    setMessageText('');
    setReplyingTo(null);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    if (!canSendMessages) return;
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

  // Open delete confirmation
  const openDeleteDialog = (message: MessageWithSender) => {
    setMessageToDelete(message);
    setDeleteDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (message: MessageWithSender) => {
    setMessageToEdit(message);
    setEditDialogOpen(true);
  };

  // Handle reply
  const handleReply = (message: MessageWithSender) => {
    setReplyingTo(message);
  };

  // Display name and status for header
  const displayName = isGroup || isChannel
    ? conversation.name || 'Unnamed'
    : (otherProfile?.full_name || otherProfile?.username || 'Unknown');

  const statusText = isGroup
    ? `${conversation.participants.length} members`
    : isChannel
      ? `${conversation.participants.length} subscribers`
      : (otherProfile?.is_online
        ? 'online'
        : otherProfile?.last_seen
          ? `last seen ${new Date(otherProfile.last_seen).toLocaleString()}`
          : 'offline');

  // Show connecting screen while starting stream
  if (isStartingStream && (isChannel || isGroup)) {
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
  if (showLiveStreamPreview && (isChannel || isGroup)) {
    return (
      <Suspense fallback={<div role="status" className="flex h-full items-center justify-center bg-background text-muted-foreground">Opening session…</div>}><LiveStreamPreview
        channelName={conversation.name || 'Channel'}
        channelAvatar={conversation.avatar_url || undefined}
        subscriberCount={conversation.participants.length}
        onStart={handleStartLiveStream}
        onSchedule={() => {
          setShowLiveStreamPreview(false);
          setShowScheduleCall(true);
        }}
        onClose={() => setShowLiveStreamPreview(false)}
      /></Suspense>
    );
  }

  // Show live stream view for channels (can be minimized)
  if (isInStream && activeStream && (isChannel || isGroup) && !isStreamMinimized) {
    return (
      <Suspense fallback={<div role="status" className="flex h-full items-center justify-center bg-background text-muted-foreground">Opening session…</div>}><LiveStreamView
        channelName={conversation.name || 'Channel'}
        channelAvatar={conversation.avatar_url || undefined}
        participants={streamParticipants}
        isAdmin={isAdminOrOwner}
        isMuted={isStreamMuted}
        isRecording={isStreamRecording}
        connectionStatus={streamConnectionStatus}
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
        remoteStreams={remoteStreams}
        localStream={useLiveStreamLocalStream}
        isStreamStarter={activeStream.started_by === user?.id}
      /></Suspense>
    );
  }

  // Show call UI if in call (for groups)
  if (isInCall && activeCall && !isChannel) {
    return (
      <Suspense fallback={<div role="status" className="flex h-full items-center justify-center bg-background text-muted-foreground">Opening session…</div>}><CallView
        callType="voice"
        participants={callParticipants}
        localStream={useCallsLocalStream}
        remoteStreams={useCallsRemoteStreams}
        isCallStarter={activeCall.started_by === user?.id}
        onLeave={leaveCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        isMuted={isMuted}
        isRecording={isCallRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        connectionStatus={connectionStatus}
      /></Suspense>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-full relative md:rounded-[2rem] md:m-2 md:shadow-2xl overflow-hidden bg-background text-foreground sg-screen-enter"
    )}>
      {/* Minimized Live Stream Bar */}
      {isInStream && activeStream && (isChannel || isGroup) && isStreamMinimized && (
        <Suspense fallback={<div role="status" className="flex h-full items-center justify-center bg-background text-muted-foreground">Opening session…</div>}><LiveStreamView
          channelName={conversation.name || 'Channel'}
          channelAvatar={conversation.avatar_url || undefined}
          participants={streamParticipants}
          isAdmin={isAdminOrOwner}
          isMuted={isStreamMuted}
          isRecording={isStreamRecording}
          connectionStatus={streamConnectionStatus}
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
          remoteStreams={remoteStreams}
          localStream={useLiveStreamLocalStream}
          isStreamStarter={activeStream.started_by === user?.id}
        /></Suspense>
      )}
      {/* Header - add top margin when minimized stream bar is visible */}
      <div className={cn(
        "flex items-center gap-3 p-3 border-b md:rounded-t-2xl backdrop-blur-md z-20 transition-all",
        "bg-card/95 border-border",
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

        <button
          onClick={() => {
            if (isGroup && isAdminOrOwner) setShowGroupSettings(true);
            else if (isChannel) setShowChannelSettings(true);
            else setShowEditProfile(true);
          }}
          className="cursor-pointer"
        >
          <Avatar
            src={isGroup || isChannel ? conversation.avatar_url : otherProfile?.avatar_url}
            name={displayName}
            size="sm"
            isOnline={isGroup || isChannel ? undefined : otherProfile?.is_online}
            type={isGroup ? 'group' : isChannel ? 'channel' : 'user'}
          />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-foreground tracking-tight">{displayName}</h2>
          <p className={cn(
            'text-xs truncate',
            isChannel ? 'text-muted-foreground' :
              (!isGroup && otherProfile?.is_online ? 'text-emerald-400' : 'text-muted-foreground')
          )}>
            {statusText}
          </p>
        </div>

        {/* Call button for direct messages */}
        {!isGroup && !isChannel && (
          <CallButton
            onStartCall={handleStartCall}
            canStartCall={true}
            hasActiveCall={!!activeCall && !isInCall}
            onJoinCall={handleJoinCall}
          />
        )}

        {/* Call button for groups and channels */}
        {(isGroup || isChannel) && (
          <CallButton
            onStartCall={handleStartCall}
            canStartCall={isAdminOrOwner}
            hasActiveCall={isChannel || isGroup ? (!!activeStream && !isInStream) : (!!activeCall && !isInCall)}
            onJoinCall={handleJoinCall}
          />
        )}

        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={isChannel ? "text-slate-300 hover:text-slate-100 hover:bg-slate-700" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Call options for direct chats */}
            {!isGroup && !isChannel && (
              <>
                <DropdownMenuItem onClick={() => handleStartCall()}>
                  <Phone className="h-4 w-4 mr-2" />
                  Voice Call
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
          onRefresh={onRefreshConversations || (() => { })}
        />
      )}

      {/* Channel Settings Dialog */}
      {isChannel && (
        <ChannelSettingsDialog
          open={showChannelSettings}
          onClose={() => setShowChannelSettings(false)}
          channel={conversation}
          isOwner={currentUserParticipant?.role === 'owner'}
          onRefresh={onRefreshConversations || (() => { })}
        />
      )}

      {/* Edit Profile Dialog for direct chats */}
      {!isGroup && !isChannel && showEditProfile && <Suspense fallback={null}>
        <EditProfileDialog open onClose={() => setShowEditProfile(false)} />
      </Suspense>}

      {/* Messages */}
      <div ref={scrollContainer} className="flex-1 overflow-y-auto scrollbar-thin py-5 bg-background">
        {hasOlder && <div className="text-center mb-3"><Button variant="secondary" size="sm" onClick={showOlder} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Earlier messages'}</Button></div>}
        {messagesError && messages.length === 0 ? (<div role="alert" className="p-8 text-center text-muted-foreground"><p>Could not load messages.</p><Button variant="secondary" onClick={() => refetch()} className="mt-3">Try again</Button></div>) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center backdrop-blur-sm border border-primary/20 shadow-lg shadow-primary/10">
                <MessageCircle className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No messages yet</h3>
            <p className="text-muted-foreground/70 text-sm text-center max-w-[250px] mb-6">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="px-1 space-y-3">
            {messages.map((message, index) => {
              const showAvatar = index === 0 ||
                messages[index - 1].sender_id !== message.sender_id;

              // Render system messages (e.g., "Live Stream Started")
              if (message.message_type === 'system') {
                const hasActiveCallOrStream = isChannel || isGroup ? !!activeStream : !!activeCall;
                const isNotInCallOrStream = isChannel || isGroup ? !isInStream : !isInCall;

                return (
                  <SystemMessage
                    key={message.id}
                    content={message.content || ''}
                    timestamp={message.created_at}
                    hasActiveCall={hasActiveCallOrStream && isNotInCallOrStream}
                    onJoinCall={handleJoinCall}
                    isChannel={isChannel}
                    isAdmin={isAdminOrOwner}
                    onDelete={() => openDeleteDialog(message)}
                  />
                );
              }

              // Use ChannelMessageBubble for channels
              if (isChannel) {
                return (
                  <ChannelMessageBubble
                    key={message.id}
                    activeStreamId={activeStream?.id}
                    onJoinStream={() => handleJoinCall()}
                    message={message}
                    reactions={reactions[message.id] || []}
                    onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                    onOpenComments={conversation.linked_discussion_id ? () => {
                      // Sync user to discussion group before navigating (for members)
                      if (!isAdminOrOwner && user?.id) {
                        try {
                          void supabase.functions.invoke('sync-discussion-members', {
                            body: { channelId: conversation.id, userId: user.id, action: 'add' }
                          }).then(result => {
                            if (result.error) throw result.error;
                            void queryClient.invalidateQueries({ queryKey: ['messages', user.id, conversation.linked_discussion_id] });
                          }).catch(() => toast.error('Unable to access comments. Please try again.'));
                        } catch (error) {
                          console.error('Failed to sync to discussion:', error);
                        }
                      }
                      onNavigateToDiscussion?.(conversation.linked_discussion_id!, message);
                    } : undefined}
                    onForward={onForwardMessage ? () => onForwardMessage(message) : undefined}
                    commentCount={message.commentCount || 0}
                    canForward={isAdminOrOwner}
                    onReply={() => handleReply(message)}

                    onEdit={() => openEditDialog(message)}
                    onDelete={() => openDeleteDialog(message)}
                    isAdmin={isAdminOrOwner}
                    onOpenBrowser={onOpenBrowser}
                  />
                );
              }

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showAvatar={showAvatar}
                  onForward={onForwardMessage ? (msg) => onForwardMessage(msg) : undefined}
                  isChannelMessage={false}
                  onReply={(msg) => handleReply(msg)}
                  onEdit={(msg) => openEditDialog(msg)}
                  onDelete={(msg) => openDeleteDialog(msg)}

                  isAdmin={isAdminOrOwner}
                  onOpenBrowser={onOpenBrowser}
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
          "bg-card/95 border-border"
        )}>
          {isRecordingVoice ? (
            <VoiceRecorder
              onRecordingComplete={sendVoiceMessage}
              onCancel={() => setIsRecordingVoice(false)}
            />
          ) : (
            <>
            {replyingTo && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="h-8 w-1 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-primary">Replying to {replyingTo.sender?.full_name || replyingTo.sender?.username || 'message'}</p>
                  <p className="truncate text-sm text-muted-foreground">{replyingTo.content || 'Attachment'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cancel reply">
                  <span className="text-lg leading-none">×</span>
                </Button>
              </div>
            )}
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
                aria-label="Add photo"
                onClick={() => imageInputRef.current?.click()}
                disabled={sending || isUploadingVoice}
                className="sg-icon-button"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || isUploadingVoice}
                className="sg-icon-button"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                placeholder={isChannel ? "Broadcast..." : "Message"}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyDown}
                disabled={sending || isUploadingVoice}
                className={cn(
                  "h-11 flex-1 min-w-0 border-border rounded-2xl transition-all focus-visible:ring-primary/50 bg-secondary text-foreground placeholder:text-muted-foreground"
                )}
              />
              {messageText.trim() ? (
                <Button
                  size="icon"
                  aria-label="Send message"
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending || isUploadingVoice}
                  className="h-11 w-11 shrink-0 rounded-2xl bg-[#d6f58b] text-[#192313] hover:bg-[#c8ed74]"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Record voice message"
                  onClick={() => setIsRecordingVoice(true)}
                  disabled={sending || isUploadingVoice}
                  className={cn(
                    "sg-icon-button"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
            </>
          )}
        </div>
      ) : isChannel && conversation.linked_discussion_id ? (
        <div className="p-4 bg-card border-t border-border text-center text-sm text-muted-foreground">Tap Comments below a post to join its conversation.</div>
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

      {editDialogOpen && messageToEdit && <EditMessageDialog key={messageToEdit.id} message={messageToEdit} onClose={() => { setEditDialogOpen(false); setMessageToEdit(null); }} onSave={updateMessage} />}

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
