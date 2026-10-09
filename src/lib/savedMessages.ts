import { supabase } from '@/integrations/supabase/client';

// The transactional RPC serializes creation and never merges/deletes older chats.
// Until deployed, read-only lookup can still open an existing self-chat safely.
export async function getSavedMessages(userId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('get_or_create_saved_messages');
  if (!error && typeof data === 'string') return data;
  if (error && error.code !== 'PGRST202' && error.code !== '42883') throw error;
  const { data: memberships, error: membershipError } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', userId);
  if (membershipError) throw membershipError;
  const ids = memberships?.map(row => row.conversation_id) || [];
  if (ids.length) {
    const [{ data: chats, error: chatError }, { data: participants, error: participantError }] = await Promise.all([
      supabase.from('conversations').select('id, created_at').in('id', ids).eq('type', 'direct').order('created_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', ids),
    ]);
    if (chatError || participantError) throw chatError || participantError;
    for (const chat of chats || []) {
      const members = participants?.filter(row => row.conversation_id === chat.id) || [];
      if (members.length === 1 && members[0].user_id === userId) return chat.id;
    }
  }
  throw new Error('Saved Messages setup needs the safe backend update. Existing chats have not been changed.');
}
