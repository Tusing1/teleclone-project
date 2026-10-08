import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  conversation_id: string | null;
  matched_at: string;
  matchedUser?: Profile;
}

interface LikedByUser {
  id: string;
  swiper_id: string;
  created_at: string;
  profile?: Profile;
}

export function useFindFriends(full = true) {
  const { user } = useAuth();
  const [potentialMatches, setPotentialMatches] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [likedByUsers, setLikedByUsers] = useState<LikedByUser[]>([]);
  const [likedByCount, setLikedByCount] = useState(0);
  const [canSeeLikes, setCanSeeLikes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeInFlightRef = useRef(false);

  const fetchPotentialMatches = useCallback(async () => {
    if (!user) return;

    try {
      // Get users that the current user has already liked or matched with
      const { data: excludedSwipes } = await supabase
        .from('user_swipes')
        .select('swiped_id')
        .eq('swiper_id', user.id)
        .eq('direction', 'right');

      const excludedIds = excludedSwipes?.map(s => s.swiped_id) || [];

      // Get all users except current user and already liked users
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (excludedIds.length > 0) {
        query = query.not('user_id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data: profiles, error } = await query.limit(50);

      if (error) throw error;
      setPotentialMatches(profiles as Profile[] || []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error fetching potential matches:', error);
    }
  }, [user]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;

    try {
      const { data: matchData, error } = await supabase
        .from('user_matches')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('matched_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for matched users
      if (matchData && matchData.length > 0) {
        const otherUserIds = matchData.map(m =>
          m.user1_id === user.id ? m.user2_id : m.user1_id
        );

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', otherUserIds);

        const matchesWithProfiles = matchData.map(m => {
          const otherUserId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          return {
            ...m,
            matchedUser: profiles?.find(p => p.user_id === otherUserId)
          };
        });

        setMatches(matchesWithProfiles);
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  }, [user]);

  const fetchLikedByCount = useCallback(async () => {
    if (!user) return;

    try {
      // Count users who swiped right on current user (that current user hasn't swiped on yet)
      const { data: swipedOnMe, error } = await supabase
        .from('user_swipes')
        .select('swiper_id')
        .eq('swiped_id', user.id)
        .eq('direction', 'right');

      if (error) throw error;

      // Filter out users we've already matched with or swiped on
      const { data: mySwipes } = await supabase
        .from('user_swipes')
        .select('swiped_id')
        .eq('swiper_id', user.id);

      const mySwipedIds = mySwipes?.map(s => s.swiped_id) || [];
      const pendingLikes = swipedOnMe?.filter(s => !mySwipedIds.includes(s.swiper_id)) || [];

      setLikedByCount(pendingLikes.length);
    } catch (error) {
      console.error('Error fetching liked by count:', error);
    }
  }, [user]);

  const fetchCanSeeLikes = useCallback(async () => {
    if (!user) return;
    setCanSeeLikes(true);
  }, [user]);

  const fetchLikedByUsers = useCallback(async () => {
    if (!user || !canSeeLikes) return;

    try {
      const { data: swipedOnMe } = await supabase
        .from('user_swipes')
        .select('*')
        .eq('swiped_id', user.id)
        .eq('direction', 'right');

      if (swipedOnMe && swipedOnMe.length > 0) {
        const swiperIds = swipedOnMe.map(s => s.swiper_id);

        // Filter out already matched users
        const { data: mySwipes } = await supabase
          .from('user_swipes')
          .select('swiped_id')
          .eq('swiper_id', user.id);

        const mySwipedIds = mySwipes?.map(s => s.swiped_id) || [];
        const pendingLikes = swipedOnMe.filter(s => !mySwipedIds.includes(s.swiper_id));

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', pendingLikes.map(s => s.swiper_id));

        const likesWithProfiles = pendingLikes.map(s => ({
          ...s,
          profile: profiles?.find(p => p.user_id === s.swiper_id)
        }));

        setLikedByUsers(likesWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching liked by users:', error);
    }
  }, [user, canSeeLikes]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        ...(full ? [fetchPotentialMatches(), fetchMatches(), fetchCanSeeLikes()] : []),
        fetchLikedByCount()
      ]);
      setLoading(false);
    };
    init();
  }, [full, fetchPotentialMatches, fetchMatches, fetchLikedByCount, fetchCanSeeLikes]);

  useEffect(() => {
    if (full && canSeeLikes) {
      fetchLikedByUsers();
    }
  }, [full, canSeeLikes, fetchLikedByUsers]);

  const swipe = async (direction: 'left' | 'right') => {
    if (!user || currentIndex >= potentialMatches.length) return null;
    if (swipeInFlightRef.current) return null;

    swipeInFlightRef.current = true;

    const swipedUser = potentialMatches[currentIndex];

    try {
      // Check if swipe already exists
      const { data: existingSwipe } = await supabase
        .from('user_swipes')
        .select('id')
        .eq('swiper_id', user.id)
        .eq('swiped_id', swipedUser.user_id)
        .maybeSingle();

      // Only insert if swipe doesn't exist
      if (!existingSwipe) {
        const { error: swipeError } = await supabase
          .from('user_swipes')
          .insert({
            swiper_id: user.id,
            swiped_id: swipedUser.user_id,
            direction
          });

        if (swipeError) throw swipeError;
      }

      // Check for match if swiped right
      if (direction === 'right') {
        console.log('Checking for mutual swipe from:', swipedUser.user_id, 'to:', user.id);

        const { data: theirSwipe, error: swipeCheckError } = await supabase
          .from('user_swipes')
          .select('*')
          .eq('swiper_id', swipedUser.user_id)
          .eq('swiped_id', user.id)
          .eq('direction', 'right')
          .maybeSingle();

        if (swipeCheckError) {
          console.error('Error checking for mutual swipe:', swipeCheckError);
        }

        console.log('Their swipe result:', theirSwipe);

        if (theirSwipe) {
          console.log('Mutual swipe detected! Creating match...');

          // Check if match already exists (prevents duplicate match errors)
          const { data: existingMatch, error: existingMatchError } = await supabase
            .from('user_matches')
            .select('*')
            .or(
              `and(user1_id.eq.${user.id},user2_id.eq.${swipedUser.user_id}),and(user1_id.eq.${swipedUser.user_id},user2_id.eq.${user.id})`
            )
            .maybeSingle();

          if (existingMatchError) {
            console.error('Error checking existing match:', existingMatchError);
          }

          if (existingMatch) {
            console.log('Match already exists:', existingMatch);
            await fetchMatches();
            setCurrentIndex(prev => prev + 1);
            return {
              matched: true,
              user: swipedUser,
              conversationId: existingMatch.conversation_id
            };
          }

          // It's a match! Create a direct conversation via backend function (bypasses RLS safely)
          console.log('Creating new conversation for match (backend function)...');

          const { data: convRes, error: convError } = await supabase.functions.invoke(
            'create-conversation',
            {
              body: {
                type: 'direct',
                memberIds: [swipedUser.user_id]
              }
            }
          );

          if (convError) {
            console.error('Error creating conversation:', convError);
            throw convError;
          }

          const conversationId = (convRes as { id?: string })?.id;
          if (!conversationId) {
            throw new Error('Conversation creation failed');
          }

          // Create the match record
          const { error: matchError } = await supabase.from('user_matches').insert({
            user1_id: user.id,
            user2_id: swipedUser.user_id,
            conversation_id: conversationId
          });

          if (matchError) {
            console.error('Error creating match:', matchError);
            // Even if match record fails, conversation was created - still return success
          }

          console.log('Match created successfully!');

          await fetchMatches();
          setCurrentIndex(prev => prev + 1);
          return { matched: true, user: swipedUser, conversationId };
        }
      }

      setCurrentIndex(prev => prev + 1);
      return { matched: false };
    } catch (error) {
      console.error('Error swiping:', error);
      toast.error('Something went wrong');
      return null;
    } finally {
      swipeInFlightRef.current = false;
    }
  };

  const unlockSeeLikes = async () => {
    if (!user) return false;

    try {
      // In a real app, this would involve payment processing
      // For now, we'll just enable it
      const { error } = await supabase
        .from('premium_unlocks')
        .upsert({
          user_id: user.id,
          can_see_likes: true
        });

      if (error) throw error;

      setCanSeeLikes(true);
      await fetchLikedByUsers();
      toast.success('Premium feature unlocked!');
      return true;
    } catch (error) {
      console.error('Error unlocking:', error);
      toast.error('Failed to unlock feature');
      return false;
    }
  };

  const currentProfile = potentialMatches[currentIndex] || null;
  const hasMoreProfiles = currentIndex < potentialMatches.length;

  return {
    currentProfile,
    hasMoreProfiles,
    matches,
    likedByCount,
    likedByUsers,
    canSeeLikes,
    loading,
    swipe,
    unlockSeeLikes,
    fetchCanSeeLikes,
    refetch: fetchPotentialMatches
  };
}
