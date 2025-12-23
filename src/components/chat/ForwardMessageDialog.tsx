import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { Search, Users, Radio, Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface ForwardMessageDialogProps {
  open: boolean;
  onClose: () => void;
  message: MessageWithSender | null;
  conversations: ConversationWithDetails[];
  onForward: (message: MessageWithSender, conversationId: string) => Promise<boolean>;
}

export function ForwardMessageDialog({
  open,
  onClose,
  message,
  conversations,
  onForward,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  // Filter out Saved Messages and current conversation, show groups and channels
  const filteredConversations = conversations.filter((c) => {
    if (c.isSavedMessages) return false;
    
    const name = c.name || c.participants.find(p => p.user_id !== user?.id)?.profile?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (conversationId: string) => {
    if (!message) return;
    
    setSending(true);
    const success = await onForward(message, conversationId);
    setSending(false);
    
    if (success) {
      onClose();
    }
  };

  const getConversationIcon = (conversation: ConversationWithDetails) => {
    if (conversation.type === 'channel') {
      return (
        <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
          <Radio className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (conversation.type === 'group') {
      return (
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
      );
    }
    const otherProfile = conversation.participants.find(p => p.user_id !== user?.id)?.profile;
    return (
      <Avatar
        src={otherProfile?.avatar_url}
        name={otherProfile?.full_name || otherProfile?.username || 'User'}
        size="sm"
      />
    );
  };

  const getConversationName = (conversation: ConversationWithDetails) => {
    if (conversation.type === 'group' || conversation.type === 'channel') {
      return conversation.name || 'Unnamed';
    }
    const otherProfile = conversation.participants.find(p => p.user_id !== user?.id)?.profile;
    return otherProfile?.full_name || otherProfile?.username || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Forward Message
          </DialogTitle>
        </DialogHeader>

        {/* Preview of what's being forwarded */}
        {message && (
          <div className="p-3 bg-muted rounded-lg text-sm mb-2">
            {message.file_name && (
              <p className="font-medium truncate">{message.file_name}</p>
            )}
            {message.content && (
              <p className="text-muted-foreground truncate">{message.content}</p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Conversation list */}
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No chats found</p>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleForward(conversation.id)}
                  disabled={sending}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left',
                    sending && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {getConversationIcon(conversation)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getConversationName(conversation)}</p>
                    <p className="text-xs text-muted-foreground">
                      {conversation.type === 'channel' ? 'Channel' : 
                       conversation.type === 'group' ? 'Group' : 'Direct'}
                    </p>
                  </div>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
