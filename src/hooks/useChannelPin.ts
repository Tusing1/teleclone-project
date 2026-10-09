import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MessageWithSender, Profile } from '@/types/chat';
import { toast } from 'sonner';

export function useChannelPin(conversationId: string, enabled: boolean) {
  const { user } = useAuth();
  const [pinned, setPinned] = useState<MessageWithSender | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const scope = `${user?.id}:${conversationId}:${enabled}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => {
    setPinned(null); setAvailable(false); setBusy(false);
    if (!enabled || !user) return;
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const ticket = ++revision;
      const { data, error } = await supabase.from('conversations').select('pinned_message_id').eq('id', conversationId).single();
      if (!active || ticket !== revision) return;
      setAvailable(!error);
      if (error || !data.pinned_message_id) { setPinned(null); return; }
      const { data: message } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).eq('id', data.pinned_message_id).maybeSingle();
      if (!message) { if (active && ticket === revision) setPinned(null); return; }
      const { data: sender } = await supabase.from('profiles').select('*').eq('user_id', message.sender_id).maybeSingle();
      if (active && ticket === revision) setPinned(sender ? { ...message, message_type: message.message_type as MessageWithSender['message_type'], sender: sender as Profile } : null);
    };
    void refresh();
    const channel = supabase.channel(`pin:${user.id}:${conversationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, refresh)
      .subscribe();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => { active = false; window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [conversationId, enabled, user?.id]);
  const changePin = useCallback(async (message: MessageWithSender | null) => {
    if (busy || !user || !enabled) return;
    if (!available) { toast.info('Channel pinning needs the pending database update.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('conversations').update({ pinned_message_id: message?.id || null }).eq('id', conversationId).select('id').single();
      if (error) throw error;
      if (currentScope.current !== scope) return;
      setPinned(message); toast.success(message ? 'Message pinned' : 'Message unpinned');
    } catch { if (currentScope.current === scope) toast.error('Could not change this pin. Only channel admins can pin posts.'); }
    finally { if (currentScope.current === scope) setBusy(false); }
  }, [available, busy, user?.id, enabled, conversationId, scope]);
  return { pinned, available, busy, changePin };
}
