import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Call } from './useCalls';
import { Profile } from '@/types/chat';

export interface CallHistoryItem extends Call {
  conversation_name: string | null;
  started_by_profile: Profile | null;
  participant_count: number;
  duration_minutes: number | null;
  has_recording: boolean;
}

export function useCallHistory(conversationId: string | null) {
  const { user } = useAuth();
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCallHistory = useCallback(async () => {
    if (!conversationId || !user) {
      setCallHistory([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch all calls for this conversation (including ended ones)
      const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching call history:', error);
        setLoading(false);
        return;
      }

      if (!calls || calls.length === 0) {
        setCallHistory([]);
        setLoading(false);
        return;
      }

      // Get conversation name
      const { data: conversation } = await supabase
        .from('conversations')
        .select('name')
        .eq('id', conversationId)
        .single();

      // Get profiles for call starters
      const starterIds = [...new Set(calls.map(c => c.started_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', starterIds);

      // Get participant counts for each call
      const callIds = calls.map(c => c.id);
      const { data: participants } = await supabase
        .from('call_participants')
        .select('call_id, user_id')
        .in('call_id', callIds);

      // Build call history items
      const historyItems: CallHistoryItem[] = calls.map(call => {
        const callParticipants = participants?.filter(p => p.call_id === call.id) || [];
        const startedByProfile = profiles?.find(p => p.user_id === call.started_by) as Profile | null;
        
        // Calculate duration
        let durationMinutes: number | null = null;
        if (call.ended_at) {
          const start = new Date(call.started_at).getTime();
          const end = new Date(call.ended_at).getTime();
          durationMinutes = Math.round((end - start) / 60000);
        }

        return {
          ...call,
          conversation_name: conversation?.name || null,
          started_by_profile: startedByProfile || null,
          participant_count: callParticipants.length,
          duration_minutes: durationMinutes,
          has_recording: !!call.recording_url
        };
      });

      setCallHistory(historyItems);
    } catch (error) {
      console.error('Error in fetchCallHistory:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  return { callHistory, loading, refetch: fetchCallHistory };
}

