import { useState, useEffect } from 'react';
import { Link2, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InviteJoinDialogProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string;
  onJoined: (conversationId: string) => void;
}

export function InviteJoinDialog({ open, onClose, inviteCode, onJoined }: InviteJoinDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    conversationId: string;
    conversationName: string;
    conversationType: string;
  } | null>(null);

  useEffect(() => {
    if (open && inviteCode) {
      validateInvite();
    }
  }, [open, inviteCode]);

  const validateInvite = async () => {
    if (!inviteCode || !user) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find the invite link
      const { data: inviteLink, error: linkError } = await supabase
        .from('channel_invite_links')
        .select('id, conversation_id, is_active, max_uses, uses_count, expires_at')
        .eq('code', inviteCode)
        .maybeSingle();

      if (linkError || !inviteLink) {
        setError('This invite link is invalid or has been deleted');
        setLoading(false);
        return;
      }

      // Check if link is active
      if (!inviteLink.is_active) {
        setError('This invite link has been disabled');
        setLoading(false);
        return;
      }

      // Check if expired
      if (inviteLink.expires_at && new Date(inviteLink.expires_at) < new Date()) {
        setError('This invite link has expired');
        setLoading(false);
        return;
      }

      // Check if max uses reached
      if (inviteLink.max_uses && inviteLink.uses_count >= inviteLink.max_uses) {
        setError('This invite link has reached its maximum uses');
        setLoading(false);
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', inviteLink.conversation_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast.info('You are already a member of this group');
        onJoined(inviteLink.conversation_id);
        onClose();
        return;
      }

      // Get conversation info
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, name, type')
        .eq('id', inviteLink.conversation_id)
        .single();

      if (convError || !conversation) {
        setError('Could not find this group or channel');
        setLoading(false);
        return;
      }

      setInviteInfo({
        conversationId: conversation.id,
        conversationName: conversation.name || 'Unnamed Group',
        conversationType: conversation.type,
      });
      setLoading(false);
    } catch (err) {
      console.error('Error validating invite:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !inviteInfo || !inviteCode) return;

    setJoining(true);
    try {
      // Get the invite link again to ensure it's still valid
      const { data: inviteLink, error: linkError } = await supabase
        .from('channel_invite_links')
        .select('id, uses_count')
        .eq('code', inviteCode)
        .single();

      if (linkError || !inviteLink) {
        toast.error('This invite link is no longer valid');
        setJoining(false);
        return;
      }

      // Add user as participant
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: inviteInfo.conversationId,
          user_id: user.id,
          role: 'member',
        });

      if (participantError) {
        if (participantError.code === '23505') {
          toast.info('You are already a member');
          onJoined(inviteInfo.conversationId);
          onClose();
          return;
        }
        throw participantError;
      }

      // Record the invite link use
      await supabase.from('invite_link_uses').insert({
        invite_link_id: inviteLink.id,
        user_id: user.id,
      });

      // Update uses count
      await supabase
        .from('channel_invite_links')
        .update({ uses_count: inviteLink.uses_count + 1 })
        .eq('id', inviteLink.id);

      // Update subscriber count for channels
      if (inviteInfo.conversationType === 'channel') {
        const { data: conv } = await supabase
          .from('conversations')
          .select('subscriber_count')
          .eq('id', inviteInfo.conversationId)
          .single();

        if (conv) {
          await supabase
            .from('conversations')
            .update({ subscriber_count: (conv.subscriber_count || 0) + 1 })
            .eq('id', inviteInfo.conversationId);
        }
      }

      toast.success(`Joined ${inviteInfo.conversationName}!`);
      onJoined(inviteInfo.conversationId);
      onClose();
    } catch (err) {
      console.error('Error joining:', err);
      toast.error('Failed to join. Please try again.');
      setJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {loading ? 'Validating Invite...' : error ? 'Invalid Invite' : "You're Invited!"}
          </DialogTitle>
          {!loading && !error && inviteInfo && (
            <DialogDescription>
              You've been invited to join{' '}
              <span className="font-semibold text-foreground">
                {inviteInfo.conversationName}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : inviteInfo && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground capitalize">
                  {inviteInfo.conversationType === 'channel' ? 'Channel' : 'Group'}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  Decline
                </Button>
                <Button onClick={handleJoin} disabled={joining}>
                  {joining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join {inviteInfo.conversationType === 'channel' ? 'Channel' : 'Group'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
