import { useState } from 'react';
import { Copy, Check, UserPlus, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InviteFriendsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteFriendsDialog({ open, onClose }: InviteFriendsDialogProps) {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);

  // Generate a unique invite link based on user ID
  const inviteLink = `${window.location.origin}/auth?ref=${user?.id?.slice(0, 8)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on StudyGram',
          text: `${profile?.full_name || profile?.username} invites you to join!`,
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Friends
          </DialogTitle>
          <DialogDescription>
            Share your unique invite link with friends to chat with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="outline" className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button onClick={handleShare} className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Anyone with this link can sign up and find you to start chatting.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}