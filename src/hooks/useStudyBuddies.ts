import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/chat';

export interface StudyBuddy {
  profile: Profile;
  source: 'friend_request' | 'match' | 'contact_sync';
  connectedAt: string;
}

export function useStudyBuddies() {
  const { user } = useAuth();
  const [buddies, setBuddies] = useState<StudyBuddy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuddies = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch Accepted Friend Requests
      const { data: friendRequests, error: frError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          updated_at,
          sender:sender_id(*),
          receiver:receiver_id(*)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (frError) throw frError;

      // Type output manually since recursive join types are tricky to infer
      interface FriendRequestResponse {
        id: string;
        sender_id: string;
        receiver_id: string;
        updated_at: string;
        sender: Profile;
        receiver: Profile;
      }

      const typedFriendRequests = (friendRequests || []) as unknown as FriendRequestResponse[];

      // 2. Fetch Matches
      const { data: matches, error: mError } = await supabase
        .from('user_matches')
        .select(`
          id,
          user1_id,
          user2_id,
          matched_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (mError) throw mError;

      // Collect IDs for matches to fetch profiles
      const matchUserIds = new Set<string>();
      matches?.forEach(m => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        matchUserIds.add(otherId);
      });

      let matchProfiles: Profile[] = [];
      if (matchUserIds.size > 0) {
        const { data: mProfiles, error: mpError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', Array.from(matchUserIds));

        if (mpError) throw mpError;
        matchProfiles = (mProfiles as Profile[]) || [];
      }

      // 3. Aggregate Results
      const buddyMap = new Map<string, StudyBuddy>();

      // Process Matches
      matches?.forEach(m => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const profile = matchProfiles.find(p => p.user_id === otherId);
        if (profile) {
          buddyMap.set(otherId, {
            profile,
            source: 'match',
            connectedAt: m.matched_at
          });
        }
      });

      // Process Friend Requests
      typedFriendRequests.forEach(fr => {
        const otherUserId = fr.sender_id === user.id ? fr.receiver_id : fr.sender_id;

        let profile: Profile | undefined;

        if (fr.sender_id === user.id) {
          profile = fr.receiver;
        } else {
          profile = fr.sender;
        }

        if (profile && !buddyMap.has(otherUserId)) {
          buddyMap.set(otherUserId, {
            profile,
            source: 'friend_request',
            connectedAt: fr.updated_at
          });
        }
      });

      setBuddies(Array.from(buddyMap.values()).sort((a, b) =>
        new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
      ));

    } catch (error) {
      console.error('Error fetching study buddies:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBuddies();
  }, [fetchBuddies]);

  return { buddies, loading, refetch: fetchBuddies };
}
