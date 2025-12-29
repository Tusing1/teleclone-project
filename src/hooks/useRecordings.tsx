import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Recording {
  id: string;
  conversation_id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  call_type: string;
  recording_url: string;
  recording_title: string | null;
  recorded_by: string | null;
  livestream_title: string | null;
}

export function useRecordings() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch all calls with recordings that user was part of
      const { data, error } = await supabase
        .from('calls')
        .select('id, conversation_id, started_by, started_at, ended_at, call_type, recording_url, recording_title, recorded_by, livestream_title')
        .not('recording_url', 'is', null)
        .order('ended_at', { ascending: false });

      if (error) throw error;

      // Filter to only include recordings (recording_url is not null)
      const validRecordings = (data || []).filter(
        (call): call is Recording => call.recording_url !== null
      );
      
      setRecordings(validRecordings);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  return {
    recordings,
    loading,
    refetch: fetchRecordings
  };
}
