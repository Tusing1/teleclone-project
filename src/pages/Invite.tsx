import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Link2, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    conversationId: string;
    conversationName: string;
    conversationType: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Store invite code and redirect to auth
      sessionStorage.setItem('pendingInviteCode', code || '');
      navigate('/auth');
      return;
    }

    validateInvite();
  }, [code, user, authLoading]);

  const validateInvite = async () => {
    if (!code) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    try {
      // Find the invite link
      const { data: inviteLink, error: linkError } = await supabase
        .from('channel_invite_links')
        .select('id, conversation_id, is_active, max_uses, uses_count, expires_at')
        .eq('code', code)
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
        .eq('user_id', user?.id)
        .maybeSingle();

      if (existingMember) {
        toast.info('You are already a member of this group');
        navigate('/', { state: { conversationId: inviteLink.conversation_id } });
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
    if (!user || !inviteInfo || !code) return;

    setJoining(true);
    try {
      // Get the invite link again to ensure it's still valid
      const { data: inviteLink, error: linkError } = await supabase
        .from('channel_invite_links')
        .select('id, uses_count')
        .eq('code', code)
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
        // Check if it's a duplicate key error (user already joined)
        if (participantError.code === '23505') {
          toast.info('You are already a member');
          navigate('/', { state: { conversationId: inviteInfo.conversationId } });
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
      navigate('/', { state: { conversationId: inviteInfo.conversationId } });
    } catch (err) {
      console.error('Error joining:', err);
      toast.error('Failed to join. Please try again.');
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Invalid Invite</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (inviteInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Link2 className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">You're Invited!</h1>
            <p className="text-muted-foreground">
              You've been invited to join{' '}
              <span className="font-semibold text-foreground">
                {inviteInfo.conversationName}
              </span>
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {inviteInfo.conversationType === 'channel' ? 'Channel' : 'Group'}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/')} variant="outline">
              Cancel
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
      </div>
    );
  }

  return null;
}
