import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Smile, Paperclip, Send, Image as ImageIcon, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { VoiceRecorder } from './VoiceRecorder';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useReactions } from '@/hooks/useReactions';
import { useVoiceMessage } from '@/hooks/useVoiceMessage';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface DiscussionViewProps {
  conversation: ConversationWithDetails;
  parentChannel?: ConversationWithDetails | null;
  replyToMessage?: MessageWithSender | null;
  onBack: () => void;
  onRefreshConversations?: () => void;
}

export function DiscussionView({ 
  conversation, 
  parentChannel,
  replyToMessage,
  onBack,
  onRefreshConversations 
}: DiscussionViewProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, uploadFile, refetch } = useMessages(conversation.id);
  const { reactions, fetchReactions, toggleReaction } = useReactions(conversation.id);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Get user's role in discussion
  const currentUserParticipant = conversation.participants.find(p => p.user_id === user?.id);
  const isAdminOrOwner = currentUserParticipant?.role === 'owner' || currentUserParticipant?.role === 'admin';
  const isMember = currentUserParticipant?.role === 'member';

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions(messages.map(m => m.id));
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;
    
    setSending(true);
    // Send message with reply reference if replying to a channel message
    await sendMessage(
      messageText.trim(), 
      'text', 
      undefined, 
      replyToMessage?.id
    );
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
      await sendMessage('', type, uploadedFile, replyToMessage?.id);
    }
    setSending(false);
    e.target.value = '';
  };

  // Get comment count - messages replying to the channel message
  const commentCount = replyToMessage 
    ? messages.filter(m => m.reply_to_channel_message_id === replyToMessage.id).length
    : messages.length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-slate-800/80 backdrop-blur border-b border-slate-700">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="shrink-0 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            {commentCount} Comment{commentCount !== 1 ? 's' : ''}
          </h2>
          {parentChannel && (
            <p className="text-xs text-slate-400 truncate">
              Discussion in {parentChannel.name}
            </p>
          )}
        </div>
      </div>

      {/* Parent Message Context */}
      {replyToMessage && (
        <div className="p-3 bg-slate-800/50 border-b border-slate-700/50">
          <div className="flex items-start gap-3">
            {parentChannel && (
              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-rose-400 text-sm">
                  {parentChannel?.name || 'Channel'}
                </span>
                <span className="text-xs text-slate-500">channel</span>
              </div>
              
              {/* Message content preview */}
              {replyToMessage.message_type === 'file' && replyToMessage.file_name ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Paperclip className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 font-medium truncate">
                      {replyToMessage.file_name}
                    </p>
                    {replyToMessage.file_size && (
                      <p className="text-xs text-slate-400">
                        {(replyToMessage.file_size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                </div>
              ) : replyToMessage.message_type === 'image' ? (
                <div className="w-20 h-20 rounded-lg overflow-hidden">
                  <img 
                    src={replyToMessage.file_url || ''} 
                    alt="Shared image" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-300 line-clamp-2">
                  {replyToMessage.content}
                </p>
              )}

              {/* Message stats */}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                {replyToMessage.view_count !== undefined && (
                  <span className="flex items-center gap-1">
                    👁 {replyToMessage.view_count?.toLocaleString() || 0}
                  </span>
                )}
                <span>
                  {format(new Date(replyToMessage.created_at), 'h:mm a')}
                </span>
              </div>
            </div>
          </div>

          {/* Discussion started indicator */}
          <div className="flex items-center justify-center my-3">
            <span className="px-3 py-1 text-xs text-slate-400 bg-slate-700/50 rounded-full">
              Discussion started
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-slate-400">Loading comments...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageCircle className="w-16 h-16 mb-4 text-slate-600" />
            <p className="font-medium">No comments yet</p>
            <p className="text-sm text-center max-w-xs mt-1">
              Be the first to comment on this post
            </p>
          </div>
        ) : (
          <div className="px-3 space-y-3">
            {messages
              .filter(m => !replyToMessage || m.reply_to_channel_message_id === replyToMessage.id)
              .map((message, index, arr) => {
                const showAvatar = index === 0 || arr[index - 1].sender_id !== message.sender_id;
                
                return (
                  <MessageBubble 
                    key={message.id} 
                    message={message}
                    showAvatar={showAvatar}
                    isChannelMessage={false}
                    isAdmin={isAdminOrOwner}
                    onReply={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onPin={() => {}}
                    discussionMode
                  />
                );
              })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input - everyone can comment in discussion */}
      <div className="p-3 bg-slate-800 border-t border-slate-700">
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
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            >
              <Smile className="h-5 w-5" />
            </Button>
            
            <Input
              placeholder="Send anonymously"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || isUploadingVoice}
              className="flex-1 border-0 bg-slate-700/50 text-slate-100 placeholder:text-slate-500"
            />
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || isUploadingVoice}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            {messageText.trim() ? (
              <Button 
                size="icon"
                onClick={handleSend}
                disabled={!messageText.trim() || sending || isUploadingVoice}
                className="shrink-0 bg-blue-500 hover:bg-blue-600"
              >
                <Send className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRecordingVoice(true)}
                disabled={sending || isUploadingVoice}
                className="shrink-0 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
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
    </div>
  );
}
