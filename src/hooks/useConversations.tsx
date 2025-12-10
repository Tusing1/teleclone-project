import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ConversationWithDetails, Profile, Message } from '@/types/chat';

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get all conversations for this user
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (participantError || !participantData?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participantData.map(p => p.conversation_id);

    // Get conversation details with participants
    const { data: conversationsData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (convError || !conversationsData) {
      setLoading(false);
      return;
    }

    // Get all participants for these conversations
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('*')
      .in('conversation_id', conversationIds);

    // Get profiles for all participants
    const participantUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', participantUserIds);

    // Get last message for each conversation
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    // Build conversation objects
    const conversationsWithDetails: ConversationWithDetails[] = conversationsData.map(conv => {
      const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];
      const participantsWithProfiles = convParticipants.map(p => ({
        ...p,
        profile: profiles?.find(profile => profile.user_id === p.user_id) as Profile
      }));

      const convMessages = lastMessages?.filter(m => m.conversation_id === conv.id) || [];
      const lastMessage = convMessages[0] as Message | undefined;

      return {
        ...conv,
        participants: participantsWithProfiles,
        lastMessage,
      };
    });

    // Sort by last message time or conversation update time
    conversationsWithDetails.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || a.updated_at;
      const bTime = b.lastMessage?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setConversations(conversationsWithDetails);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to new messages to update conversation list
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const createConversation = async (otherUserId: string) => {
    if (!user) return null;

    // Check if conversation already exists
    const { data: existingParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (existingParticipants) {
      for (const p of existingParticipants) {
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('*')
          .eq('conversation_id', p.conversation_id)
          .eq('user_id', otherUserId)
          .maybeSingle();

        if (otherParticipant) {
          // Conversation exists, return its ID
          return p.conversation_id;
        }
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError || !newConv) return null;

    // Add participants
    await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: otherUserId }
      ]);

    await fetchConversations();
    return newConv.id;
  };

  return { conversations, loading, createConversation, refetch: fetchConversations };
}