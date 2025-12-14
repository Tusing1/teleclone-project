import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreVertical, Paperclip, Send, Smile, Image as ImageIcon, Bookmark, Users, Radio, Settings, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { CallButton } from './CallButton';
import { CallView } from './CallView';
import { ChannelSettingsDialog } from './ChannelSettingsDialog';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useCalls } from '@/hooks/useCalls';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onForwardMessage?: (message: MessageWithSender) => void;
  onNavigateToDiscussion?: (discussionId: string) => void;
  onRefreshConversations?: () => void;
}

export function ChatView({ conversation, onBack, onForwardMessage, onNavigateToDiscussion, onRefreshConversations }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, uploadFile } = useMessages(
    conversation.id, 
    conversation.linked_discussion_id
  );
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isSavedMessages = conversation.isSavedMessages;
  const isGroup = conversation.type === 'group';
  const isChannel = conversation.type === 'channel';
  const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
  const otherProfile = otherParticipant?.profile;
  
  // Check if current user can send messages (owner/admin for channels, anyone for groups/direct)
  const currentUserParticipant = conversation.participants.find(p => p.user_id === user?.id);
  const canSendMessages = !isChannel || currentUserParticipant?.role === 'owner' || currentUserParticipant?.role === 'admin';
  const isAdminOrOwner = currentUserParticipant?.role === 'owner' || currentUserParticipant?.role === 'admin';

  // Calls
  const {
    activeCall,
    participants: callParticipants,
    isInCall,
    localStream,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    toggleVideo
  } = useCalls(conversation.id);

  const handleStartCall = async (type: 'voice' | 'video') => {
    const callId = await startCall(type);
    if (callId) {
      toast({ title: `${type === 'video' ? 'Video' : 'Voice'} call started` });
    } else {
      toast({ title: 'Failed to start call', variant: 'destructive' });
    }
  };

  const handleJoinCall = async () => {
    if (activeCall) {
      await joinCall(activeCall.id, activeCall.call_type);
    }
  };

  const currentParticipant = callParticipants.find(p => p.user_id === user?.id);
  const isMuted = currentParticipant?.is_muted ?? false;
  const isVideoOff = currentParticipant?.is_video_off ?? false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Show call UI if in call
  if (isInCall && activeCall) {
    return (
      <CallView
        callType={activeCall.call_type}
        participants={callParticipants}
        localStream={localStream}
        isCallStarter={activeCall.started_by === user?.id}
        onLeave={leaveCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-card border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="md:hidden shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {isSavedMessages ? (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-primary-foreground" />
          </div>
        ) : isGroup ? (
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
        ) : isChannel ? (
          <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
        ) : (
          <Avatar
            src={otherProfile?.avatar_url}
            name={displayName}
            size="sm"
            isOnline={otherProfile?.is_online}
          />
        )}
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{displayName}</h2>
          <p className={cn(
            'text-xs truncate',
            !isSavedMessages && !isGroup && !isChannel && otherProfile?.is_online ? 'text-online' : 'text-muted-foreground'
          )}>
            {statusText}
          </p>
        </div>
        
        {/* Call button for groups and channels */}
        {(isGroup || isChannel) && !isSavedMessages && (
          <CallButton
            onStartCall={handleStartCall}
            canStartCall={isAdminOrOwner}
            hasActiveCall={!!activeCall && !isInCall}
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
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        )}
        
        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
          <>
            {messages.map((message, index) => {
              const showAvatar = index === 0 || 
                messages[index - 1].sender_id !== message.sender_id;
              return (
                <MessageBubble 
                  key={message.id} 
                  message={message}
                  showAvatar={showAvatar}
                  onForward={!isSavedMessages ? onForwardMessage : undefined}
                  isChannelMessage={isChannel && !!conversation.linked_discussion_id}
                  onOpenComments={isChannel && conversation.linked_discussion_id ? () => {
                    onNavigateToDiscussion?.(conversation.linked_discussion_id!);
                  } : undefined}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {canSendMessages ? (
        <div className="p-3 bg-card border-t border-border">
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
              disabled={sending}
            >
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Input
              placeholder={isSavedMessages ? "Write a note..." : "Message"}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="flex-1 bg-secondary border-0"
            />
            <Button 
              size="icon"
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : isChannel && conversation.linked_discussion_id ? (
        <div className="p-3 bg-card border-t border-border">
          <Button 
            variant="secondary" 
            className="w-full"
            onClick={() => onNavigateToDiscussion?.(conversation.linked_discussion_id!)}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Open Discussion to Comment
          </Button>
        </div>
      ) : isChannel ? (
        <div className="p-3 bg-card border-t border-border text-center text-sm text-muted-foreground">
          Only admins can post to this channel
        </div>
      ) : null}
    </div>
  );
}