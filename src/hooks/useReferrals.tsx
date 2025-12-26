import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Profile } from '@/types/chat';

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
  referredUser?: Profile;
}

export function useReferrals() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('user_referrals') as any)
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch profiles for referred users
        const referredIds = data.map((r: Referral) => r.referred_id);
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', referredIds);

        const referralsWithProfiles = data.map((r: Referral) => ({
          ...r,
          referredUser: profiles?.find(p => p.user_id === r.referred_id)
        }));

        setReferrals(referralsWithProfiles);
        setReferralCount(data.length);
      } else {
        setReferrals([]);
        setReferralCount(0);
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchReferrals();
      setLoading(false);
    };
    init();
  }, [fetchReferrals]);

  const createReferral = useCallback(async (referrerId: string) => {
    if (!user) return false;

    try {
      // Check if this user was already referred
      const { data: existing } = await (supabase
        .from('user_referrals') as any)
        .select('id')
        .eq('referred_id', user.id)
        .maybeSingle();

      if (existing) {
        console.log('User already has a referrer');
        return false;
      }

      // Create the referral
      const { error } = await (supabase
        .from('user_referrals') as any)
        .insert({
          referrer_id: referrerId,
          referred_id: user.id
        });

      if (error) throw error;

      // Update the profile with referred_by
      await supabase
        .from('profiles')
        .update({ referred_by: referrerId })
        .eq('user_id', user.id);

      return true;
    } catch (error) {
      console.error('Error creating referral:', error);
      return false;
    }
  }, [user]);

  const getReferrerIdFromCode = (code: string): string | null => {
    // The code is the first 8 characters of the user's UUID
    // We need to find the full user ID
    return code; // This will be matched against profiles
  };

  const processReferralCode = useCallback(async (code: string) => {
    if (!user || !code) return false;

    try {
      // Find the referrer by matching the code (first 8 chars of their user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('user_id', `${code}%`)
        .limit(1);

      if (profiles && profiles.length > 0) {
        const referrerId = profiles[0].user_id;
        
        // Don't allow self-referral
        if (referrerId === user.id) {
          return false;
        }

        return await createReferral(referrerId);
      }

      return false;
    } catch (error) {
      console.error('Error processing referral code:', error);
      return false;
    }
  }, [user, createReferral]);

  return {
    referrals,
    referralCount,
    loading,
    createReferral,
    processReferralCode,
    refetch: fetchReferrals
  };
}
