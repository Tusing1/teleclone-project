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
          responded_at,
          created_at
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (frError) throw frError;

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

      // 3. Collect all unique User IDs to fetch profiles for
      const userIdsToFetch = new Set<string>();

      friendRequests?.forEach(fr => {
        userIdsToFetch.add(fr.sender_id);
        userIdsToFetch.add(fr.receiver_id);
      });

      matches?.forEach(m => {
        userIdsToFetch.add(m.user1_id);
        userIdsToFetch.add(m.user2_id);
      });

      // Remove self
      userIdsToFetch.delete(user.id);

      let fetchedProfiles: Profile[] = [];
      if (userIdsToFetch.size > 0) {
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', Array.from(userIdsToFetch));

        if (pError) throw pError;
        fetchedProfiles = (profiles as Profile[]) || [];
      }

      // 4. Aggregate Results
      const buddyMap = new Map<string, StudyBuddy>();

      // Process Matches
      matches?.forEach(m => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const profile = fetchedProfiles.find(p => p.user_id === otherId);
        if (profile) {
          buddyMap.set(otherId, {
            profile,
            source: 'match',
            connectedAt: m.matched_at
          });
        }
      });

      // Process Friend Requests
      friendRequests?.forEach(fr => {
        const otherUserId = fr.sender_id === user.id ? fr.receiver_id : fr.sender_id;
        const profile = fetchedProfiles.find(p => p.user_id === otherUserId);

        if (profile && !buddyMap.has(otherUserId)) {
          buddyMap.set(otherUserId, {
            profile,
            source: 'friend_request',
            // Use responded_at for when they became friends, fallback to created_at
            connectedAt: fr.responded_at || fr.created_at || new Date().toISOString()
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
