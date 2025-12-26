import { MessageCircle, Users, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useFindFriends } from '@/hooks/useFindFriends';
import { formatDistanceToNow } from 'date-fns';

interface MessageFriendsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function MessageFriendsDialog({ open, onClose, onSelectConversation }: MessageFriendsDialogProps) {
  const { user } = useAuth();
  const { matches, loading } = useFindFriends();

  const handleSelect = (conversationId: string | null) => {
    if (conversationId) {
      onSelectConversation(conversationId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Message Friends
          </DialogTitle>
          <DialogDescription>
            Chat with your matched friends
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No friends yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Find and match with people to start chatting
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {matches.map((match) => {
                const profile = match.matchedUser;
                const displayName = profile?.full_name || profile?.username || 'Unknown';
                
                return (
                  <button
                    key={match.id}
                    onClick={() => handleSelect(match.conversation_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar
                      src={profile?.avatar_url}
                      name={displayName}
                      isOnline={profile?.is_online}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Matched {formatDistanceToNow(new Date(match.matched_at), { addSuffix: true })}
                      </p>
                    </div>
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
