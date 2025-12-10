import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Profile } from '@/types/chat';

export function useUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user.id)
        .order('username');

      if (!error && data) {
        setUsers(data as Profile[]);
      }
      setLoading(false);
    };

    fetchUsers();

    // Subscribe to profile updates for online status
    const channel = supabase
      .channel('profiles-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          setUsers(prev => 
            prev.map(u => 
              u.user_id === (payload.new as any).user_id 
                ? { ...u, ...(payload.new as any) } 
                : u
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const searchUsers = async (query: string): Promise<Profile[]> => {
    if (!user || !query.trim()) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('user_id', user.id)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10);

    if (error) return [];
    return data as Profile[];
  };

  return { users, loading, searchUsers };
}