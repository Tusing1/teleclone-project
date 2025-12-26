import { UserPlus, Check, X, MessageSquare, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { formatDistanceToNow } from 'date-fns';

interface FriendRequestsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}

export function FriendRequestsDialog({ open, onClose, onOpenConversation }: FriendRequestsDialogProps) {
  const { incomingRequests, loading, acceptRequest, rejectRequest } = useFriendRequests();

  const handleAccept = async (requestId: string) => {
    const conversationId = await acceptRequest(requestId);
    if (conversationId) {
      onOpenConversation(conversationId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Friend Requests
          </DialogTitle>
          <DialogDescription>
            People who want to connect with you
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No pending requests</p>
              <p className="text-xs text-muted-foreground mt-1">
                When someone sends you a request, it will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingRequests.map((request) => {
                const profile = request.sender_profile;
                const displayName = profile?.full_name || profile?.username || 'Unknown';
                
                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg bg-secondary/30 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={profile?.avatar_url}
                        name={displayName}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {request.message && (
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{request.message}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAccept(request.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => rejectRequest(request.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
