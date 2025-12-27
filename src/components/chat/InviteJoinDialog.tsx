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
      // 1. Get consolidated details securely
      const { data: result, error: linkError } = await (supabase.rpc as any)(
        'get_invite_details',
        { invite_code: inviteCode }
      );

      if (linkError) {
        console.error('❌ Database error validating invite:', linkError);
        setError('Error connecting to group service');
        setLoading(false);
        return;
      }

      if (!result) {
        console.warn('⚠️ Invite link not found:', inviteCode);
        setError('This invite link is invalid or has been deleted');
        setLoading(false);
        return;
      }

      // Clear the session storage now that we've found it
      sessionStorage.removeItem('pendingInviteCode');

      const inviteLink = result.invite;
      const conversation = result.conversation;
      const isMember = result.is_member;

      // Check key properties
      if (!inviteLink.is_active) {
        setError('This invite link has been disabled by the administrator');
        setLoading(false);
        return;
      }

      if (inviteLink.expires_at) {
        const expiryDate = new Date(inviteLink.expires_at);
        if (expiryDate < new Date()) {
          setError(`This invite link expired on ${expiryDate.toLocaleDateString()}`);
          setLoading(false);
          return;
        }
      }

      if (inviteLink.max_uses && inviteLink.uses_count >= inviteLink.max_uses) {
        setError('This invite link has reached its maximum uses');
        setLoading(false);
        return;
      }

      if (isMember) {
        toast.info('You are already a member of this group');
        onJoined(conversation.id);
        onClose();
        return;
      }

      if (!conversation) {
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
      const { data, error } = await (supabase.rpc as any)('join_channel_with_invite_code', {
        invite_code: inviteCode
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean, conversation_id: string, already_member?: boolean };

      if (result.already_member) {
        toast.info('You are already a member');
      } else {
        toast.success(`Joined ${inviteInfo.conversationName}!`);
      }

      onJoined(result.conversation_id);
      onClose();
    } catch (err: any) {
      console.error('Error joining:', err);
      // Extract error message from Postgres error if available
      const message = err.message || err.details || 'Failed to join. Please try again.';
      toast.error(message);
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
