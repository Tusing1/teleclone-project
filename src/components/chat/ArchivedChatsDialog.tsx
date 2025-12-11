import { Archive, ArchiveRestore } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { ConversationWithDetails } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';

interface ArchivedChatsDialogProps {
  open: boolean;
  onClose: () => void;
  archivedConversations: ConversationWithDetails[];
  onUnarchive: (conversationId: string) => Promise<boolean>;
  onSelectConversation: (conversationId: string) => void;
}

export function ArchivedChatsDialog({
  open,
  onClose,
  archivedConversations,
  onUnarchive,
  onSelectConversation,
}: ArchivedChatsDialogProps) {
  const { user } = useAuth();

  const handleUnarchive = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    await onUnarchive(conversationId);
  };

  const handleSelect = (conversationId: string) => {
    onSelectConversation(conversationId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archived Chats
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {archivedConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No archived chats</p>
            </div>
          ) : (
            <div className="space-y-1">
              {archivedConversations.map((conv) => {
                const otherParticipant = conv.participants.find(p => p.user_id !== user?.id);
                const profile = otherParticipant?.profile;
                const displayName = conv.isSavedMessages 
                  ? 'Saved Messages' 
                  : profile?.full_name || profile?.username || 'Unknown';

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelect(conv.id)}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar
                      src={profile?.avatar_url}
                      name={displayName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{displayName}</span>
                      <span className="text-sm text-muted-foreground truncate block">
                        {conv.lastMessage?.content || 'No messages'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleUnarchive(e, conv.id)}
                      className="shrink-0"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}