import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MessageWithSender, Profile } from '@/types/chat';

export function useMessages(conversationId: string | null, linkedDiscussionId?: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommentCounts = useCallback(async (messageIds: string[]) => {
    if (!linkedDiscussionId || messageIds.length === 0) return {};

    const { data } = await supabase
      .from('messages')
      .select('reply_to_channel_message_id')
      .eq('conversation_id', linkedDiscussionId)
      .in('reply_to_channel_message_id', messageIds);

    const counts: Record<string, number> = {};
    data?.forEach(msg => {
      if (msg.reply_to_channel_message_id) {
        counts[msg.reply_to_channel_message_id] = (counts[msg.reply_to_channel_message_id] || 0) + 1;
      }
    });
    return counts;
  }, [linkedDiscussionId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !messagesData) {
      setLoading(false);
      return;
    }

    // Get sender profiles
    const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', senderIds);

    // Fetch comment counts if this is a channel with discussion
    const messageIds = messagesData.map(m => m.id);
    const commentCounts = await fetchCommentCounts(messageIds);

    const messagesWithSenders: MessageWithSender[] = messagesData.map(msg => ({
      ...msg,
      message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
      sender: profiles?.find(p => p.user_id === msg.sender_id) as Profile,
      commentCount: commentCounts[msg.id] || 0
    }));

    setMessages(messagesWithSenders);
    setLoading(false);
  }, [conversationId, fetchCommentCounts]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Get sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', newMessage.sender_id)
            .single();

          const messageWithSender: MessageWithSender = {
            ...newMessage,
            message_type: newMessage.message_type as 'text' | 'image' | 'file' | 'system',
            sender: profile as Profile,
            commentCount: 0
          };

          setMessages(prev => [...prev, messageWithSender]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async (
    content: string, 
    type: 'text' | 'image' | 'file' | 'system' = 'text', 
    fileData?: { url: string; name: string; size: number },
    replyToChannelMessageId?: string
  ) => {
    if (!user || !conversationId) return null;

    const messageData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: type === 'text' || type === 'system' ? content : null,
      message_type: type,
    };

    if (fileData) {
      messageData.file_url = fileData.url;
      messageData.file_name = fileData.name;
      messageData.file_size = fileData.size;
    }

    if (replyToChannelMessageId) {
      messageData.reply_to_channel_message_id = replyToChannelMessageId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) return null;

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (uploadError) return null;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      name: file.name,
      size: file.size
    };
  };

  return { messages, loading, sendMessage, uploadFile, refetch: fetchMessages };
}