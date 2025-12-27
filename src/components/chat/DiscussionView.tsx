import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Smile, Paperclip, Send, Image as ImageIcon, Radio, Ban, Trash2 } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface DiscussionViewProps {
  conversation: ConversationWithDetails;
  parentChannel?: ConversationWithDetails | null;
  replyToMessage?: MessageWithSender | null;
  onBack: () => void;
  onRefreshConversations?: () => void;
  onOpenBrowser?: (url: string) => void;
}

export function DiscussionView({
  conversation,
  parentChannel,
  replyToMessage,
  onBack,
  onRefreshConversations,
  onOpenBrowser
}: DiscussionViewProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, uploadFile, refetch } = useMessages(conversation.id);
  const { reactions, fetchReactions, toggleReaction } = useReactions(conversation.id);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<MessageWithSender | null>(null);
  const [restrictMember, setRestrictMember] = useState<{ userId: string; username: string } | null>(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [isRestricted, setIsRestricted] = useState(false);
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

  // Check if current user is restricted
  useEffect(() => {
    const checkRestriction = async () => {
      if (!user?.id || !conversation.id) return;

      const { data } = await supabase
        .from('discussion_restricted_members')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Check if restriction has expired
        if (data.restricted_until && new Date(data.restricted_until) < new Date()) {
          // Remove expired restriction
          await supabase
            .from('discussion_restricted_members')
            .delete()
            .eq('id', data.id);
          setIsRestricted(false);
        } else {
          setIsRestricted(true);
        }
      } else {
        setIsRestricted(false);
      }
    };

    checkRestriction();
  }, [user?.id, conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions(messages.map(m => m.id));
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || sending || isRestricted) return;

    setSending(true);
    // Send message with reply reference
    const replyToId = replyingTo?.id || replyToMessage?.id;
    await sendMessage(
      messageText.trim(),
      'text',
      undefined,
      replyToId
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
    const file = e.target.files?.[0];
    if (!file || isRestricted) return;

    setSending(true);
    const uploadedFile = await uploadFile(file);
    if (uploadedFile) {
      const replyToId = replyingTo?.id || replyToMessage?.id;
      await sendMessage('', type, uploadedFile, replyToId);
    }
    setSending(false);
    setReplyingTo(null);
    e.target.value = '';
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyingTo(message);
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessage) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', deleteMessage.id);

    if (error) {
      toast.error('Failed to delete message');
    } else {
      toast.success('Message deleted');
      refetch();
    }
    setDeleteMessage(null);
  };

  const handleRestrictMember = async () => {
    if (!restrictMember || !user?.id) return;

    // Set restriction for 24 hours
    const restrictedUntil = new Date();
    restrictedUntil.setHours(restrictedUntil.getHours() + 24);

    const { error } = await supabase
      .from('discussion_restricted_members')
      .upsert({
        conversation_id: conversation.id,
        user_id: restrictMember.userId,
        restricted_by: user.id,
        reason: restrictReason || 'Too many messages',
        restricted_until: restrictedUntil.toISOString(),
      });

    if (error) {
      toast.error('Failed to restrict member');
    } else {
      toast.success(`${restrictMember.username} has been restricted for 24 hours`);
    }
    setRestrictMember(null);
    setRestrictReason('');
  };

  // Get comment count - messages replying to the channel message
  const commentCount = replyToMessage
    ? messages.filter(m => m.reply_to_channel_message_id === replyToMessage.id).length
    : messages.length;

  // Filter messages for this discussion
  const discussionMessages = messages.filter(m =>
    !replyToMessage || m.reply_to_channel_message_id === replyToMessage.id
  );

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
        ) : discussionMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageCircle className="w-16 h-16 mb-4 text-slate-600" />
            <p className="font-medium">No comments yet</p>
            <p className="text-sm text-center max-w-xs mt-1">
              Be the first to comment on this post
            </p>
          </div>
        ) : (
          <div className="px-3 space-y-3">
            {discussionMessages.map((message, index, arr) => {
              const showAvatar = index === 0 || arr[index - 1].sender_id !== message.sender_id;
              const isOwnMessage = message.sender_id === user?.id;
              const canDelete = isOwnMessage || isAdminOrOwner;
              const canReply = isOwnMessage || isAdminOrOwner; // Members can reply to their own, admins to any

              return (
                <div key={message.id} className="group relative">
                  <MessageBubble
                    message={message}
                    showAvatar={showAvatar}
                    isChannelMessage={false}
                    isAdmin={isAdminOrOwner}
                    onReply={canReply ? handleReply : undefined}
                    onEdit={() => { }}
                    onDelete={canDelete ? () => setDeleteMessage(message) : undefined}
                    onPin={() => { }}
                    discussionMode
                    onOpenBrowser={onOpenBrowser}
                  />

                  {/* Admin: Restrict member option */}
                  {isAdminOrOwner && !isOwnMessage && message.sender && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 hover:text-amber-400 hover:bg-slate-700/50"
                      onClick={() => setRestrictMember({
                        userId: message.sender_id,
                        username: message.sender.username || 'User'
                      })}
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-3 py-2 bg-slate-700/50 border-t border-slate-600 flex items-center gap-2">
          <div className="w-1 h-8 bg-blue-500 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-400 font-medium">
              Replying to {replyingTo.sender?.username || 'message'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {replyingTo.content || (replyingTo.file_name ? `📎 ${replyingTo.file_name}` : 'Media')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-slate-200"
            onClick={() => setReplyingTo(null)}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Restriction notice */}
      {isRestricted && (
        <div className="px-3 py-2 bg-red-900/30 border-t border-red-800/50 flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-300">
            You are restricted from sending messages in this discussion.
          </p>
        </div>
      )}

      {/* Input - everyone can comment in discussion (unless restricted) */}
      {!isRestricted && (
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
                placeholder={replyingTo ? "Reply to message..." : "Send a comment"}
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
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteMessage} onOpenChange={() => setDeleteMessage(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Message</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restrict member dialog */}
      <Dialog open={!!restrictMember} onOpenChange={() => setRestrictMember(null)}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Restrict Member</DialogTitle>
            <DialogDescription className="text-slate-400">
              Restrict {restrictMember?.username} from sending messages for 24 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="text-slate-300">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Too many messages, spam, etc."
                value={restrictReason}
                onChange={(e) => setRestrictReason(e.target.value)}
                className="mt-1.5 bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestrictMember(null)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestrictMember}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              <Ban className="h-4 w-4 mr-2" />
              Restrict
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
