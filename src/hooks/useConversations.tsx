import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ConversationWithDetails, Profile, Message } from '@/types/chat';

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<ConversationWithDetails[]>([]);
  const [savedMessagesId, setSavedMessagesId] = useState<string | null>(null);
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
      setArchivedConversations([]);
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

      // Check if this is a self-chat conversation (only one participant, it's the current user, and it's a direct type)
      const isSelfChat = conv.type === 'direct' && convParticipants.length === 1 && convParticipants[0].user_id === user.id;

      return {
        ...conv,
        participants: participantsWithProfiles,
        lastMessage,
        isSavedMessages: isSelfChat, // Keep this for backwards compatibility
        isSelfChat,
        is_archived: conv.is_archived || false,
      };
    });

    // Find and store self-chat ID (only one should exist now)
    const selfChatConv = conversationsWithDetails.find(c => c.isSelfChat || c.isSavedMessages);
    if (selfChatConv) {
      setSavedMessagesId(selfChatConv.id);
    }

    // Separate archived and active conversations
    const active = conversationsWithDetails.filter(c => !c.is_archived);
    const archived = conversationsWithDetails.filter(c => c.is_archived);

    // Sort by last message time (self-chat treated like any other conversation now)
    const sortFn = (a: ConversationWithDetails, b: ConversationWithDetails) => {
      const aTime = a.lastMessage?.created_at || a.updated_at;
      const bTime = b.lastMessage?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    };

    active.sort(sortFn);
    archived.sort(sortFn);

    setConversations(active);
    setArchivedConversations(archived);
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
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

    // Check if a DIRECT conversation already exists between these two users
    const { data: existingParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (existingParticipants) {
      for (const p of existingParticipants) {
        // First verify this is a DIRECT conversation
        const { data: convData } = await supabase
          .from('conversations')
          .select('type')
          .eq('id', p.conversation_id)
          .single();

        if (convData?.type !== 'direct') continue;

        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('*')
          .eq('conversation_id', p.conversation_id)
          .eq('user_id', otherUserId)
          .maybeSingle();

        if (otherParticipant) {
          // Direct conversation exists, return its ID
          return p.conversation_id;
        }
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({ type: 'direct' })
      .select()
      .single();

    if (convError || !newConv) return null;

    // Add participants
    await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: user.id, role: 'member' },
        { conversation_id: newConv.id, user_id: otherUserId, role: 'member' }
      ]);

    await fetchConversations();
    return newConv.id;
  };

  const createGroup = async (name: string, description: string, memberIds: string[]): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('create-conversation', {
        body: { type: 'group', name, description, memberIds }
      });

      if (error) {
        console.error('Group creation error:', error);
        return null;
      }

      await fetchConversations();
      return data?.id || null;
    } catch (err) {
      console.error('Group creation failed:', err);
      return null;
    }
  };

  const createChannel = async (name: string, description: string, enableDiscussion: boolean = true): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('create-conversation', {
        body: { type: 'channel', name, description, memberIds: [], enableDiscussion }
      });

      if (error) {
        console.error('Channel creation error:', error);
        return null;
      }

      await fetchConversations();
      return data?.id || null;
    } catch (err) {
      console.error('Channel creation failed:', err);
      return null;
    }
  };

  const archiveConversation = async (conversationId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: true })
      .eq('id', conversationId);

    if (error) return false;
    await fetchConversations();
    return true;
  };

  const unarchiveConversation = async (conversationId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: false })
      .eq('id', conversationId);

    if (error) return false;
    await fetchConversations();
    return true;
  };

  const getOrCreateSavedMessages = async (): Promise<string | null> => {
    if (!user) return null;

    // Return existing saved messages conversation
    if (savedMessagesId) return savedMessagesId;

    // Check if it exists but wasn't loaded yet
    const { data: participantData } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (participantData) {
      for (const p of participantData) {
        // First check if this conversation is type 'direct'
        const { data: convData } = await supabase
          .from('conversations')
          .select('type')
          .eq('id', p.conversation_id)
          .single();

        if (convData?.type !== 'direct') continue;

        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('*')
          .eq('conversation_id', p.conversation_id);

        // Saved Messages = direct conversation with only the current user
        if (participants?.length === 1 && participants[0].user_id === user.id) {
          setSavedMessagesId(p.conversation_id);
          return p.conversation_id;
        }
      }
    }

    // Create new Saved Messages conversation via edge function (to bypass RLS)
    try {
      const { data, error } = await supabase.functions.invoke('create-conversation', {
        body: { type: 'saved' }
      });

      if (error) {
        console.error('Error creating Saved Messages via edge function:', error);
        return null;
      }

      if (data?.id) {
        setSavedMessagesId(data.id);
        await fetchConversations();
        return data.id;
      }

      return null;
    } catch (err) {
      console.error('Failed to create Saved Messages:', err);
      return null;
    }
  };

  const forwardToSavedMessages = async (message: Message): Promise<boolean> => {
    if (!user) {
      console.error('forwardToSavedMessages: No user');
      return false;
    }

    const savedId = await getOrCreateSavedMessages();
    if (!savedId) {
      console.error('forwardToSavedMessages: Could not get or create Saved Messages');
      return false;
    }

    const forwardedContent = message.content
      ? `📤 Forwarded:\n${message.content}`
      : '📤 Forwarded message';

    const messageData: any = {
      conversation_id: savedId,
      sender_id: user.id,
      content: forwardedContent,
      message_type: message.message_type,
    };

    if (message.file_url) {
      messageData.file_url = message.file_url;
      messageData.file_name = message.file_name;
      messageData.file_size = message.file_size;
    }

    const { error } = await supabase
      .from('messages')
      .insert(messageData);

    if (error) {
      console.error('forwardToSavedMessages: Error inserting message:', error);
      return false;
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', savedId);

    return true;
  };

  const forwardToConversation = async (message: Message, conversationId: string): Promise<boolean> => {
    if (!user) {
      console.error('forwardToConversation: No user');
      return false;
    }

    const forwardedContent = message.content
      ? `📤 Forwarded:\n${message.content}`
      : '📤 Forwarded message';

    const messageData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: forwardedContent,
      message_type: message.message_type,
    };

    if (message.file_url) {
      messageData.file_url = message.file_url;
      messageData.file_name = message.file_name;
      messageData.file_size = message.file_size;
    }

    const { error } = await supabase
      .from('messages')
      .insert(messageData);

    if (error) {
      console.error('forwardToConversation: Error inserting message:', error);
      return false;
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return true;
  };

  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    if (!user) return false;

    // Check if user is admin/owner of this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (!participant || !['admin', 'owner'].includes(participant.role)) {
      console.error('User is not admin/owner of this conversation');
      return false;
    }

    // Delete all messages first
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    // Delete all participants
    await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId);

    // Delete the conversation itself - this requires a migration to add DELETE policy
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }

    await fetchConversations();
    return true;
  };

  const getUserRole = (conversationId: string): string | null => {
    if (!user) return null;
    const conv = [...conversations, ...archivedConversations].find(c => c.id === conversationId);
    if (!conv) return null;
    const participant = conv.participants.find(p => p.user_id === user.id);
    return participant?.role || null;
  };

  return {
    conversations,
    archivedConversations,
    loading,
    createConversation,
    createGroup,
    createChannel,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    getUserRole,
    refetch: fetchConversations,
    savedMessagesId,
    getOrCreateSavedMessages,
    forwardToSavedMessages,
    forwardToConversation
  };
}
