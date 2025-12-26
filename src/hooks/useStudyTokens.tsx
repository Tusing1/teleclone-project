import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface TokenBalance {
  balance: number;
  total_earned: number;
}

interface TokenTransaction {
  id: string;
  amount: number;
  transaction_type: 'earn' | 'spend';
  activity_type: string;
  description: string | null;
  created_at: string;
}

// Token costs for premium features
export const TOKEN_COSTS = {
  ONE_WEEK_PREMIUM: 200,
  SEE_WHO_LIKES: 100,
  RECORD_CALLS: 150,
  EXTENDED_AI: 75,
} as const;

// Token rewards for activities
export const TOKEN_REWARDS = {
  REFERRAL: 50,
  COMPLETE_PROFILE: 25,
  FULL_LIVESTREAM: 20,
  PLAY_GAME: 10,
  MAKE_10_FRIENDS: 100,
  DAILY_LOGIN: 5,
  ASK_AI: 5,
} as const;

export function useStudyTokens() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('study_tokens') as any)
        .select('balance, total_earned')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setBalance(data);
      } else {
        // Initialize tokens for user if not exists
        const { error: insertError } = await (supabase
          .from('study_tokens') as any)
          .insert({ user_id: user.id, balance: 0, total_earned: 0 });
        
        if (!insertError) {
          setBalance({ balance: 0, total_earned: 0 });
        }
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('token_transactions') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchBalance(), fetchTransactions()]);
      setLoading(false);
    };
    init();
  }, [fetchBalance, fetchTransactions]);

  const earnTokens = useCallback(async (
    amount: number, 
    activityType: string, 
    description: string
  ) => {
    if (!user) return false;

    try {
      // Update balance
      const { error: updateError } = await (supabase
        .from('study_tokens') as any)
        .update({ 
          balance: (balance?.balance || 0) + amount,
          total_earned: (balance?.total_earned || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log transaction
      const { error: transactionError } = await (supabase
        .from('token_transactions') as any)
        .insert({
          user_id: user.id,
          amount,
          transaction_type: 'earn',
          activity_type: activityType,
          description
        });

      if (transactionError) throw transactionError;

      await Promise.all([fetchBalance(), fetchTransactions()]);
      toast.success(`+${amount} Study Tokens earned!`);
      return true;
    } catch (error) {
      console.error('Error earning tokens:', error);
      toast.error('Failed to earn tokens');
      return false;
    }
  }, [user, balance, fetchBalance, fetchTransactions]);

  const spendTokens = useCallback(async (
    amount: number, 
    activityType: string, 
    description: string
  ) => {
    if (!user || !balance || balance.balance < amount) {
      toast.error('Not enough tokens');
      return false;
    }

    try {
      // Update balance
      const { error: updateError } = await (supabase
        .from('study_tokens') as any)
        .update({ 
          balance: balance.balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log transaction
      const { error: transactionError } = await (supabase
        .from('token_transactions') as any)
        .insert({
          user_id: user.id,
          amount: -amount,
          transaction_type: 'spend',
          activity_type: activityType,
          description
        });

      if (transactionError) throw transactionError;

      await Promise.all([fetchBalance(), fetchTransactions()]);
      toast.success(`${amount} tokens spent on ${description}`);
      return true;
    } catch (error) {
      console.error('Error spending tokens:', error);
      toast.error('Failed to spend tokens');
      return false;
    }
  }, [user, balance, fetchBalance, fetchTransactions]);

  const unlockPremiumWithTokens = useCallback(async (feature: keyof typeof TOKEN_COSTS) => {
    const cost = TOKEN_COSTS[feature];
    
    if (!balance || balance.balance < cost) {
      toast.error(`You need ${cost} tokens. Current balance: ${balance?.balance || 0}`);
      return false;
    }

    const success = await spendTokens(cost, feature.toLowerCase(), `Unlocked ${feature.replace(/_/g, ' ').toLowerCase()}`);
    
    if (success && user) {
      // Enable the premium feature
      if (feature === 'SEE_WHO_LIKES') {
        await supabase
          .from('premium_unlocks')
          .upsert({
            user_id: user.id,
            can_see_likes: true
          });
      }
    }

    return success;
  }, [balance, spendTokens, user]);

  return {
    balance: balance?.balance || 0,
    totalEarned: balance?.total_earned || 0,
    transactions,
    loading,
    earnTokens,
    spendTokens,
    unlockPremiumWithTokens,
    refetch: () => Promise.all([fetchBalance(), fetchTransactions()])
  };
}
