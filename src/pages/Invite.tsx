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
      console.log('🔗 No user found, storing invite code in session:', code);
      sessionStorage.setItem('pendingInviteCode', code || '');
      navigate('/auth');
      return;
    }

    validateInvite();
  }, [code, user, authLoading, navigate]);

  const validateInvite = async () => {
    if (!code) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    console.log('🔗 Validating invite code:', code);
    setLoading(true);

    try {
      // Use secure RPC function to get invite details (bypasses RLS)
      const { data: result, error: linkError } = await (supabase.rpc as any)(
        'get_invite_details',
        { invite_code: code }
      );

      if (linkError) {
        console.error('❌ Database error fetching invite:', linkError);
        setError('Database error validating invite link');
        setLoading(false);
        return;
      }

      if (!result) {
        console.warn('⚠️ Invite link not found in database:', code);
        setError('This invite link does not exist or has been deleted');
        setLoading(false);
        return;
      }

      const inviteLink = result.invite;
      const conversation = result.conversation;
      const isMember = result.is_member;

      console.log('✅ Found invite link:', inviteLink);

      // Check if link is active
      if (!inviteLink.is_active) {
        setError('This invite link has been manually disabled by an admin');
        setLoading(false);
        return;
      }

      // Check if expired
      if (inviteLink.expires_at) {
        const expiryDate = new Date(inviteLink.expires_at);
        const now = new Date();
        console.log('📅 Checking expiry:', { expiryDate, now, isExpired: expiryDate < now });
        if (expiryDate < now) {
          setError(`This invite link expired on ${expiryDate.toLocaleDateString()} at ${expiryDate.toLocaleTimeString()}`);
          setLoading(false);
          return;
        }
      }

      // Check if max uses reached
      if (inviteLink.max_uses && inviteLink.uses_count >= inviteLink.max_uses) {
        setError('This invite link has reached its maximum uses');
        setLoading(false);
        return;
      }

      // Check if user is already a member
      if (isMember) {
        toast.info('You are already a member of this group');
        navigate('/', { state: { conversationId: conversation.id } });
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
    if (!user || !inviteInfo || !code) return;

    setJoining(true);
    try {
      // Use secure RPC function to join (bypasses RLS, handles all logic atomically)
      const { data, error } = await (supabase.rpc as any)('join_channel_with_invite_code', {
        invite_code: code,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        conversation_id: string;
        already_member?: boolean;
      };

      if (result?.already_member) {
        toast.info('You are already a member');
      } else {
        toast.success(`Joined ${inviteInfo.conversationName}!`);
      }

      navigate('/', { state: { conversationId: result.conversation_id } });
    } catch (err: any) {
      console.error('Error joining:', err);
      const message = err?.message || err?.details || 'Failed to join. Please try again.';
      toast.error(message);
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
