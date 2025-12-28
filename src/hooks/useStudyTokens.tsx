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

interface LoginStreak {
  current_streak: number;
  longest_streak: number;
  last_login_date: string | null;
}

interface TokenPurchase {
  id: string;
  amount_ugx: number;
  tokens: number;
  payment_method: string;
  activation_code: string;
  status: string;
  created_at: string;
}

// Token costs for premium features
export const TOKEN_COSTS = {
  ONE_WEEK_PREMIUM: 350,
  SEE_WHO_LIKES_DAILY: 100,
  SEE_WHO_LIKES_WEEKLY: 350,
  RECORD_CALLS: 150,
  EXTENDED_AI: 75,
  UNLOCK_AI_CHAT: 50,
  LONGER_CALLS: 100,
  UNLIMITED_AI: 500,
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

// Token packages for purchase
export const TOKEN_PACKAGES = [
  { tokens: 100, price: 1000, label: '100 Tokens', savings: null },
  { tokens: 200, price: 1800, label: '200 Tokens', savings: '10% off' },
  { tokens: 500, price: 4000, label: '500 Tokens', savings: '20% off' },
  { tokens: 1000, price: 7000, label: '1000 Tokens', savings: '30% off' },
] as const;

// Generate unique activation code
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TK';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useStudyTokens() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [pendingPurchases, setPendingPurchases] = useState<TokenPurchase[]>([]);
  const [globalStats, setGlobalStats] = useState<{ supply: number; burnt: number; value: number } | null>(null);
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

  const fetchStreak = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('login_streaks') as any)
        .select('current_streak, longest_streak, last_login_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStreak(data);
      } else {
        // Initialize streak for user
        const { error: insertError } = await (supabase
          .from('login_streaks') as any)
          .insert({ user_id: user.id, current_streak: 0, longest_streak: 0 });

        if (!insertError) {
          setStreak({ current_streak: 0, longest_streak: 0, last_login_date: null });
        }
      }
    } catch (error) {
      console.error('Error fetching streak:', error);
    }
  }, [user]);

  const fetchPendingPurchases = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase
        .from('token_purchases') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingPurchases(data || []);
    } catch (error) {
      console.error('Error fetching pending purchases:', error);
    }
  }, [user]);

  const fetchGlobalStats = useCallback(async () => {
    try {
      // Get all-time earned (Supply)
      const { data: earnedData } = await supabase
        .from('token_transactions')
        .select('amount')
        .eq('transaction_type', 'earn');

      const supply = earnedData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

      // Get all-time spent (Burnt)
      const { data: spentData } = await supabase
        .from('token_transactions')
        .select('amount')
        .eq('transaction_type', 'spend');

      const burnt = spentData?.reduce((acc, curr) => acc + Math.abs(curr.amount), 0) || 0;

      // Calculate a pseudo-value based on scarcity (burnt/supply ratio)
      const burnRatio = supply > 0 ? burnt / supply : 0;
      const value = 1 + (burnRatio * 2); // Value increases as more tokens are burnt

      setGlobalStats({ supply, burnt, value });
    } catch (error) {
      console.error('Error fetching global token stats:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchBalance(),
        fetchTransactions(),
        fetchStreak(),
        fetchPendingPurchases(),
        fetchGlobalStats()
      ]);
      setLoading(false);
    };
    init();
  }, [fetchBalance, fetchTransactions, fetchStreak, fetchPendingPurchases, fetchGlobalStats]);

  // Check and update daily login streak
  const checkDailyLogin = useCallback(async () => {
    if (!user) return null;

    // Check if already logged in today (session flag)
    const sessionKey = `daily_login_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) {
      return null; // Already checked today in this session
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Fetch current streak
      const { data: currentStreak, error: fetchError } = await (supabase
        .from('login_streaks') as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let newStreak = 1;
      let isNewDay = true;

      if (currentStreak?.last_login_date === today) {
        // Already logged in today
        isNewDay = false;
        sessionStorage.setItem(sessionKey, 'true');
        return null;
      }

      if (currentStreak?.last_login_date === yesterday) {
        // Consecutive day - increment streak
        newStreak = (currentStreak.current_streak || 0) + 1;
      }
      // Otherwise, streak resets to 1

      const longestStreak = Math.max(newStreak, currentStreak?.longest_streak || 0);

      // Update streak in database
      if (currentStreak) {
        await (supabase
          .from('login_streaks') as any)
          .update({
            current_streak: newStreak,
            longest_streak: longestStreak,
            last_login_date: today,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        await (supabase
          .from('login_streaks') as any)
          .insert({
            user_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_login_date: today
          });
      }

      // Calculate tokens earned (base + milestone bonuses)
      let baseReward = TOKEN_REWARDS.DAILY_LOGIN;
      let milestoneBonus = 0;
      let milestoneMessage = '';

      // Check for milestone bonuses
      if (newStreak === 7) {
        milestoneBonus = 25;
        milestoneMessage = '🎉 7-day streak milestone!';
      } else if (newStreak === 14) {
        milestoneBonus = 50;
        milestoneMessage = '🔥 14-day streak milestone!';
      } else if (newStreak === 30) {
        milestoneBonus = 100;
        milestoneMessage = '🏆 30-day streak milestone!';
      }

      const totalReward = baseReward + milestoneBonus;

      // Award tokens for daily login
      if (milestoneBonus > 0) {
        await earnTokens(totalReward, 'daily_login', `Day ${newStreak} + ${milestoneMessage}`);
      } else {
        await earnTokens(baseReward, 'daily_login', `Day ${newStreak} streak bonus`);
      }

      // Mark as checked for this session
      sessionStorage.setItem(sessionKey, 'true');

      // Refresh streak data
      await fetchStreak();

      return {
        streak: newStreak,
        tokensEarned: totalReward,
        milestoneBonus,
        milestoneMessage
      };
    } catch (error) {
      console.error('Error checking daily login:', error);
      return null;
    }
  }, [user]);

  const earnTokens = useCallback(async (
    amount: number,
    activityType: string,
    description: string
  ) => {
    if (!user) return false;

    try {
      // Get current balance first
      const { data: currentData } = await (supabase
        .from('study_tokens') as any)
        .select('balance, total_earned')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentBalance = currentData?.balance || 0;
      const currentTotal = currentData?.total_earned || 0;

      // Update balance
      const { error: updateError } = await (supabase
        .from('study_tokens') as any)
        .update({
          balance: currentBalance + amount,
          total_earned: currentTotal + amount,
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
  }, [user, fetchBalance, fetchTransactions]);

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

    const description = feature === 'SEE_WHO_LIKES_DAILY' ? 'Unlocked See Likes (24h)' :
      feature === 'SEE_WHO_LIKES_WEEKLY' ? 'Unlocked See Likes (1 Week)' :
        `Unlocked ${String(feature).replace(/_/g, ' ').toLowerCase()}`;

    const success = await spendTokens(cost, String(feature).toLowerCase(), description);

    if (success && user) {
      // For see_likes, we still update the dedicated table for legacy reasons
      if (feature === 'SEE_WHO_LIKES_DAILY' || feature === 'SEE_WHO_LIKES_WEEKLY') {
        const { error } = await supabase
          .from('premium_unlocks')
          .upsert({
            user_id: user.id,
            can_see_likes: true,
            unlocked_at: new Date().toISOString()
          });

        if (error) console.error("Error updating premium status:", error);
      }

      // Other features are tracked via token_transactions (handled in spendTokens)
    }

    return success;
  }, [balance, spendTokens, user]);

  const isFeatureUnlocked = useCallback(async (feature: string) => {
    if (!user) return false;

    try {
      const featureKey = feature.toLowerCase();

      // Special handling for see_likes which has a dedicated table
      if (featureKey.includes('see_who_likes')) {
        const { data: premium } = await supabase
          .from('premium_unlocks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (premium && premium.can_see_likes) {
          const unlockedAt = new Date(premium.unlocked_at).getTime();
          const now = Date.now();
          const duration = featureKey.includes('daily') ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
          if (now - unlockedAt < duration) return true;
        }
      }

      // General check against transaction history for all features
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: transactions } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('transaction_type', 'spend')
        .eq('activity_type', featureKey)
        .gt('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (transactions && transactions.length > 0) {
        const tx = transactions[0];
        const txDate = new Date(tx.created_at).getTime();
        const now = Date.now();

        if (featureKey.includes('daily')) {
          return (now - txDate) < 24 * 60 * 60 * 1000;
        }
        return true; // Week-based or permanent for a week
      }

      return false;
    } catch (e) {
      console.error("Error checking feature status:", e);
      return false;
    }
  }, [user]);

  // Create a token purchase and return the activation code
  const createPurchase = useCallback(async (
    tokens: number,
    priceUgx: number,
    paymentMethod: 'mtn' | 'airtel'
  ) => {
    if (!user) return null;

    const activationCode = generateActivationCode();

    try {
      const { data, error } = await (supabase
        .from('token_purchases') as any)
        .insert({
          user_id: user.id,
          tokens,
          amount_ugx: priceUgx,
          payment_method: paymentMethod,
          activation_code: activationCode,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      await fetchPendingPurchases();
      return { activationCode, purchase: data };
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast.error('Failed to create purchase');
      return null;
    }
  }, [user, fetchPendingPurchases]);

  // Activate tokens with a code (for when user confirms payment received)
  const activateCode = useCallback(async (code: string) => {
    if (!user) return false;

    try {
      // Find the purchase
      const { data: purchase, error: findError } = await (supabase
        .from('token_purchases') as any)
        .select('*')
        .eq('activation_code', code.toUpperCase())
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (findError) throw findError;

      if (!purchase) {
        toast.error('Invalid or already used activation code');
        return false;
      }

      // Mark as activated
      const { error: updateError } = await (supabase
        .from('token_purchases') as any)
        .update({
          status: 'activated',
          activated_at: new Date().toISOString()
        })
        .eq('id', purchase.id);

      if (updateError) throw updateError;

      // Award tokens
      await earnTokens(purchase.tokens, 'purchase', `Purchased ${purchase.tokens} tokens`);
      await fetchPendingPurchases();

      toast.success(`${purchase.tokens} tokens activated!`);
      return true;
    } catch (error) {
      console.error('Error activating code:', error);
      toast.error('Failed to activate code');
      return false;
    }
  }, [user, earnTokens, fetchPendingPurchases]);

  return {
    balance: balance?.balance || 0,
    totalEarned: balance?.total_earned || 0,
    transactions,
    streak,
    pendingPurchases,
    earnTokens,
    spendTokens,
    unlockPremiumWithTokens,
    checkDailyLogin,
    createPurchase,
    activateCode,
    isFeatureUnlocked,
    globalStats,
    loading,
    refetch: () => Promise.all([fetchBalance(), fetchTransactions(), fetchStreak(), fetchPendingPurchases(), fetchGlobalStats()])
  };
}
