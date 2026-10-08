import { useState, useEffect } from 'react';
import { Copy, Check, UserPlus, Share2, Users, Award } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useReferrals } from '@/hooks/useReferrals';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface InviteFriendsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteFriendsDialog({ open, onClose }: InviteFriendsDialogProps) {
  const { user, profile } = useAuth();
  const { referrals, referralCount, loading } = useReferrals();
  const [copied, setCopied] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);

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
            Share your invite link and grow your study circle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Referral stats */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Friends Invited</p>
                <p className="text-2xl font-bold">{referralCount}</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">Study circle growth</div>
          </div>

          {/* Invite link */}
          <div className="flex items-center gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="flex-1 text-sm"
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

          {/* View invited friends */}
          {referralCount > 0 && (
            <div>
              <Button 
                variant="ghost" 
                className="w-full justify-between"
                onClick={() => setShowReferrals(!showReferrals)}
              >
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  View invited friends
                </span>
                <span className="text-muted-foreground">{referralCount}</span>
              </Button>

              {showReferrals && (
                <ScrollArea className="h-40 mt-2 border rounded-lg p-2">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Loading...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {referrals.map((ref) => (
                        <div 
                          key={ref.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                        >
                          <Avatar
                            src={ref.referredUser?.avatar_url}
                            name={ref.referredUser?.full_name || ref.referredUser?.username || 'User'}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {ref.referredUser?.full_name || ref.referredUser?.username || 'User'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(ref.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            +50
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Invite links make it easy to grow your study circle.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
