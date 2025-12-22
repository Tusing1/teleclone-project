import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface MessageReactions {
  [messageId: string]: Reaction[];
}

export function useReactions(conversationId: string | null) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<MessageReactions>({});

  const fetchReactions = async (messageIds: string[]) => {
    if (!messageIds.length || !user) return;

    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds);

    if (data) {
      const grouped: MessageReactions = {};
      
      messageIds.forEach(messageId => {
        const messageReactions = data.filter(r => r.message_id === messageId);
        const emojiCounts: { [emoji: string]: { count: number; userReacted: boolean } } = {};
        
        messageReactions.forEach(reaction => {
          if (!emojiCounts[reaction.emoji]) {
            emojiCounts[reaction.emoji] = { count: 0, userReacted: false };
          }
          emojiCounts[reaction.emoji].count++;
          if (reaction.user_id === user.id) {
            emojiCounts[reaction.emoji].userReacted = true;
          }
        });
        
        grouped[messageId] = Object.entries(emojiCounts).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          userReacted: data.userReacted
        }));
      });
      
      setReactions(prev => ({ ...prev, ...grouped }));
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const currentReactions = reactions[messageId] || [];
    const existingReaction = currentReactions.find(r => r.emoji === emoji && r.userReacted);

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
      
      setReactions(prev => ({
        ...prev,
        [messageId]: prev[messageId]?.map(r => 
          r.emoji === emoji 
            ? { ...r, count: r.count - 1, userReacted: false }
            : r
        ).filter(r => r.count > 0) || []
      }));
    } else {
      // Add reaction
      await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });
      
      setReactions(prev => {
        const current = prev[messageId] || [];
        const existing = current.find(r => r.emoji === emoji);
        
        if (existing) {
          return {
            ...prev,
            [messageId]: current.map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, userReacted: true }
                : r
            )
          };
        } else {
          return {
            ...prev,
            [messageId]: [...current, { emoji, count: 1, userReacted: true }]
          };
        }
      });
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`reactions-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        () => {
          // Refetch reactions when changes occur
          const messageIds = Object.keys(reactions);
          if (messageIds.length) {
            fetchReactions(messageIds);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { reactions, fetchReactions, toggleReaction };
}
