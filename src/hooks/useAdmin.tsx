import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PendingPurchase {
  id: string;
  user_id: string;
  amount_ugx: number;
  tokens: number;
  payment_method: string;
  activation_code: string;
  status: string;
  created_at: string;
  expires_at: string;
  profile?: {
    username: string;
    full_name: string | null;
  };
}

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);

  // Check if user is admin
  const checkAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase
        .from('user_roles') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch all pending purchases (admin only)
  const fetchPendingPurchases = useCallback(async () => {
    if (!user || !isAdmin) return;

    try {
      const { data, error } = await (supabase
        .from('token_purchases') as any)
        .select(`
          *,
          profile:profiles!token_purchases_user_id_fkey(username, full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        // If the foreign key join fails, fetch without it
        const { data: fallbackData, error: fallbackError } = await (supabase
          .from('token_purchases') as any)
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        
        // Fetch profiles separately
        const userIds = (fallbackData || []).map((p: any) => String(p.user_id)).filter((id: string, index: number, self: string[]) => self.indexOf(id) === index);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        setPendingPurchases(
          (fallbackData || []).map((p: any) => ({
            ...p,
            profile: profileMap.get(p.user_id)
          }))
        );
        return;
      }

      setPendingPurchases(data || []);
    } catch (error) {
      console.error('Error fetching pending purchases:', error);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingPurchases();
    }
  }, [isAdmin, fetchPendingPurchases]);

  // Activate a purchase (admin action)
  const activatePurchase = useCallback(async (purchaseId: string) => {
    if (!isAdmin) {
      toast.error('Unauthorized');
      return false;
    }

    try {
      // Get the purchase details
      const { data: purchase, error: fetchError } = await (supabase
        .from('token_purchases') as any)
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (fetchError) throw fetchError;
      if (!purchase) throw new Error('Purchase not found');

      // Mark as activated
      const { error: updateError } = await (supabase
        .from('token_purchases') as any)
        .update({
          status: 'activated',
          activated_at: new Date().toISOString()
        })
        .eq('id', purchaseId);

      if (updateError) throw updateError;

      // Get user's current balance
      const { data: currentTokens } = await (supabase
        .from('study_tokens') as any)
        .select('balance, total_earned')
        .eq('user_id', purchase.user_id)
        .single();

      // Update user's token balance
      const { error: tokenError } = await (supabase
        .from('study_tokens') as any)
        .update({
          balance: (currentTokens?.balance || 0) + purchase.tokens,
          total_earned: (currentTokens?.total_earned || 0) + purchase.tokens,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', purchase.user_id);

      if (tokenError) throw tokenError;

      // Log the transaction
      await (supabase
        .from('token_transactions') as any)
        .insert({
          user_id: purchase.user_id,
          amount: purchase.tokens,
          transaction_type: 'earn',
          activity_type: 'purchase',
          description: `Purchased ${purchase.tokens} tokens via ${purchase.payment_method.toUpperCase()}`
        });

      await fetchPendingPurchases();
      toast.success(`Activated ${purchase.tokens} tokens for user`);
      return true;
    } catch (error) {
      console.error('Error activating purchase:', error);
      toast.error('Failed to activate purchase');
      return false;
    }
  }, [isAdmin, fetchPendingPurchases]);

  // Reject/expire a purchase
  const rejectPurchase = useCallback(async (purchaseId: string) => {
    if (!isAdmin) {
      toast.error('Unauthorized');
      return false;
    }

    try {
      const { error } = await (supabase
        .from('token_purchases') as any)
        .update({ status: 'expired' })
        .eq('id', purchaseId);

      if (error) throw error;

      await fetchPendingPurchases();
      toast.success('Purchase rejected');
      return true;
    } catch (error) {
      console.error('Error rejecting purchase:', error);
      toast.error('Failed to reject purchase');
      return false;
    }
  }, [isAdmin, fetchPendingPurchases]);

  return {
    isAdmin,
    loading,
    pendingPurchases,
    activatePurchase,
    rejectPurchase,
    refetch: fetchPendingPurchases
  };
}