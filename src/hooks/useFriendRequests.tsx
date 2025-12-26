import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Profile } from '@/types/chat';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
  sender_profile?: Profile;
  receiver_profile?: Profile;
}

export function useFriendRequests() {
  const { user } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch incoming requests
      const { data: incoming, error: inError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inError) throw inError;

      // Fetch sender profiles
      if (incoming && incoming.length > 0) {
        const senderIds = incoming.map(r => r.sender_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', senderIds);

        const withProfiles = incoming.map(req => ({
          ...req,
          status: req.status as 'pending' | 'accepted' | 'rejected',
          sender_profile: profiles?.find(p => p.user_id === req.sender_id) as Profile | undefined
        }));
        setIncomingRequests(withProfiles);
      } else {
        setIncomingRequests([]);
      }

      // Fetch sent requests
      const { data: sent, error: sentError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      setSentRequests((sent || []).map(r => ({
        ...r,
        status: r.status as 'pending' | 'accepted' | 'rejected'
      })));
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const sendRequest = async (receiverId: string, message?: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if request already exists
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .single();

      if (existing) {
        if (existing.status === 'pending') {
          toast.info('Request already sent');
        } else if (existing.status === 'accepted') {
          toast.info('You are already friends');
        }
        return false;
      }

      // Check if already have a conversation
      const { data: convs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (convs) {
        for (const conv of convs) {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id);
          
          const hasReceiver = participants?.some(p => p.user_id === receiverId);
          if (hasReceiver && participants?.length === 2) {
            toast.info('You already have a conversation with this user');
            return false;
          }
        }
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: message || null
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send request');
      return false;
    }
  };

  const acceptRequest = async (requestId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const request = incomingRequests.find(r => r.id === requestId);
      if (!request) return null;

      // Update request status
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create conversation using edge function
      const { data, error: convError } = await supabase.functions.invoke('create-conversation', {
        body: { participantId: request.sender_id }
      });

      if (convError) throw convError;

      toast.success('Friend request accepted!');
      await fetchRequests();
      return data?.conversationId || null;
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
      return null;
    }
  };

  const rejectRequest = async (requestId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request declined');
      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to decline request');
      return false;
    }
  };

  const getRequestStatus = (userId: string): 'none' | 'pending_sent' | 'pending_received' | 'friends' => {
    const sent = sentRequests.find(r => r.receiver_id === userId);
    const received = incomingRequests.find(r => r.sender_id === userId);
    
    if (sent?.status === 'accepted' || received?.status === 'accepted') return 'friends';
    if (sent?.status === 'pending') return 'pending_sent';
    if (received?.status === 'pending') return 'pending_received';
    return 'none';
  };

  const hasPendingIncoming = (userId: string): boolean => {
    return incomingRequests.some(r => r.sender_id === userId && r.status === 'pending');
  };

  return {
    incomingRequests,
    sentRequests,
    loading,
    pendingCount: incomingRequests.length,
    sendRequest,
    acceptRequest,
    rejectRequest,
    getRequestStatus,
    hasPendingIncoming,
    refetch: fetchRequests,
  };
}
