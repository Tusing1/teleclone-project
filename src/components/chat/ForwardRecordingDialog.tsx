import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { ConversationWithDetails } from '@/types/chat';
import { Recording } from '@/hooks/useRecordings';
import { Search, Users, Radio, Send, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ForwardRecordingDialogProps {
  open: boolean;
  onClose: () => void;
  recording: Recording | null;
  conversations: ConversationWithDetails[];
}

export function ForwardRecordingDialog({
  open,
  onClose,
  recording,
  conversations,
}: ForwardRecordingDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (c.isSavedMessages) return false;
    
    const name = c.name || c.participants.find(p => p.user_id !== user?.id)?.profile?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (conversationId: string) => {
    if (!recording || !user) return;
    
    setSending(true);
    try {
      // Create a message with the recording as an audio file
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_type: 'audio',
        content: `🎙️ ${recording.recording_title || recording.livestream_title || 'Recording'}`,
        file_url: recording.recording_url,
        file_name: `${recording.recording_title || 'recording'}.webm`,
      });

      if (error) throw error;
      
      toast.success('Recording forwarded');
      onClose();
    } catch (error) {
      console.error('Error forwarding recording:', error);
      toast.error('Failed to forward recording');
    } finally {
      setSending(false);
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
            Forward Recording
          </DialogTitle>
        </DialogHeader>

        {/* Preview of recording */}
        {recording && (
          <div className="p-3 bg-muted rounded-lg text-sm mb-2 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {recording.recording_title || recording.livestream_title || 'Recording'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {recording.call_type} recording
              </p>
            </div>
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
