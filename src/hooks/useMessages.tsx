import { useEffect, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MessageWithSender, Profile } from '@/types/chat';
import { useEncryption } from './useEncryption';
import { EncryptionMetadata } from '@/lib/encryption';

type MessageCursor = { createdAt: string; id: string };
type MessagePage = { rows: MessageWithSender[]; nextCursor: MessageCursor | null };
const PAGE_SIZE = 80;

export function useMessages(
  conversationId: string | null, 
  linkedDiscussionId?: string | null,
  recipientUserId?: string | null, // For direct messages to enable E2EE
  threadId?: string | null,
  canPublish = true
) {
  const { user, profile: ownProfile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['messages', user?.id, conversationId, threadId || null];
  const setMessages = (update: (previous: MessageWithSender[]) => MessageWithSender[]) => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(queryKey, previous => {
      if (!previous) return previous;
      const allRows = previous.pages.flatMap(page => page.rows);
      const updated = update(allRows);
      const byId = new Map(updated.map(message => [message.id, message]));
      const oldIds = new Set(allRows.map(message => message.id));
      const added = updated.filter(message => !oldIds.has(message.id));
      return { ...previous, pages: previous.pages.map((page, index) => ({
        ...page,
        rows: [...page.rows.filter(message => byId.has(message.id)).map(message => byId.get(message.id)!), ...(index === 0 ? added : [])]
          .sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
      })) };
    });
  };
  const { isInitialized: encryptionReady, encryptForUser, decryptMessage: decryptContent } = useEncryption();

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

  const fetchMessages = useCallback(async ({ pageParam }: { pageParam: MessageCursor | null }): Promise<MessagePage> => {
    if (!conversationId) {
      return { rows: [], nextCursor: null };
    }

    let request = supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
    if (threadId) request = request.eq('reply_to_channel_message_id', threadId);
    if (pageParam) request = request.or(`created_at.lt.${pageParam.createdAt},and(created_at.eq.${pageParam.createdAt},id.lt.${pageParam.id})`);
    const { data: messagesData, error } = await request;

    if (error) throw error;
    if (!messagesData) return { rows: [], nextCursor: null };

    // Get sender profiles
    const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
    const [{ data: profiles }, commentCounts] = await Promise.all([
      senderIds.length ? supabase.from('profiles').select('*').in('user_id', senderIds) : Promise.resolve({ data: [] }),
      fetchCommentCounts(messagesData.map(m => m.id))
    ]);

    // Decrypt encrypted messages
    const decryptedMessages = await Promise.all(
      messagesData.map(async (msg) => {
        let content = msg.is_encrypted && !encryptionReady ? '🔒 Unlocking encrypted message…' : msg.content;
        
        // Check if message is encrypted and we can decrypt it
        if (msg.is_encrypted && msg.encryption_metadata && encryptionReady) {
          try {
            const metadata = msg.encryption_metadata as unknown as EncryptionMetadata;
            const decrypted = await decryptContent(msg.content || '', metadata);
            if (decrypted) {
              content = decrypted;
            } else {
              content = '🔒 [Encrypted message - unable to decrypt]';
            }
          } catch (err) {
            console.error('Failed to decrypt message:', err);
            content = '🔒 [Encrypted message - decryption failed]';
          }
        }
        
        return {
          ...msg,
          content,
          message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
          sender: profiles?.find(p => p.user_id === msg.sender_id) as Profile,
          commentCount: commentCounts[msg.id] || 0
        };
      })
    );

    // Cached reads render immediately; refreshes keep the current messages visible.

    // Mark unread messages from others as read
    const unreadMessageIds = messagesData
      .filter(m => m.sender_id !== user?.id && !m.is_read)
      .map(m => m.id);

    if (unreadMessageIds.length > 0) {
      void supabase.from('messages').update({ is_read: true }).in('id', unreadMessageIds).then(() => {});
    }

    // Views apply to channel posts only, not every DM on every navigation.
    if (linkedDiscussionId && user?.id) {
      void Promise.all(messagesData.filter(m => m.sender_id !== user.id).map(m =>
        supabase.rpc('record_message_view', { p_message_id: m.id, p_user_id: user.id })
      ));
    }
    const oldest = messagesData[messagesData.length - 1];
    return { rows: decryptedMessages.reverse(), nextCursor: messagesData.length === PAGE_SIZE && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null };
  }, [conversationId, threadId, fetchCommentCounts, user?.id, encryptionReady, decryptContent, linkedDiscussionId]);

  const { data, isLoading: loading, error, refetch, fetchNextPage: loadOlder, hasNextPage: hasOlder, isFetchingNextPage: loadingOlder } = useInfiniteQuery({
    queryKey,
    queryFn: fetchMessages,
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (page: MessagePage) => page.nextCursor || undefined,
    enabled: !!conversationId && !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const messages = useMemo(() => data?.pages.flatMap(page => page.rows).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) || [], [data]);
  useEffect(() => {
    if (encryptionReady && messages.some(message => message.content === '🔒 Unlocking encrypted message…')) void refetch();
  }, [encryptionReady, conversationId, messages]);

  useEffect(() => {
    if (!linkedDiscussionId) return;
    const channel = supabase.channel(`comment-counts-${linkedDiscussionId}-${crypto.randomUUID()}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${linkedDiscussionId}`,
    }, () => { void queryClient.invalidateQueries({ queryKey }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, linkedDiscussionId, user?.id]);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}-${crypto.randomUUID()}`)
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
          if (threadId && newMessage.reply_to_channel_message_id !== threadId) return;
          
          // Get sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', newMessage.sender_id)
            .single();

          // Decrypt if encrypted
          let content = newMessage.is_encrypted && !encryptionReady ? '🔒 Unlocking encrypted message…' : newMessage.content;
          if (newMessage.is_encrypted && newMessage.encryption_metadata && encryptionReady) {
            try {
              const decrypted = await decryptContent(newMessage.content, newMessage.encryption_metadata as EncryptionMetadata);
              if (decrypted) {
                content = decrypted;
              } else {
                content = '🔒 [Encrypted message - unable to decrypt]';
              }
            } catch (err) {
              console.error('Failed to decrypt realtime message:', err);
              content = '🔒 [Encrypted message - decryption failed]';
            }
          }

          const messageWithSender: MessageWithSender = {
            ...newMessage,
            content,
            message_type: newMessage.message_type as 'text' | 'image' | 'file' | 'system',
            sender: profile as Profile,
            commentCount: 0
          };

          setMessages(prev => prev.some(m => m.id === messageWithSender.id) ? prev : [...prev, messageWithSender].sort((a,b) => a.created_at.localeCompare(b.created_at)));

          // Mark message as read and record view if it's from someone else
          if (newMessage.sender_id !== user?.id) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
            
            // Record view for this message
            try {
              await supabase.rpc('record_message_view', { 
                p_message_id: newMessage.id, 
                p_user_id: user?.id 
              });
            } catch (err) {
              console.error('Failed to record view:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          void refetch();
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
        setMessages(previous => previous.filter(message => message.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, threadId, user?.id, encryptionReady, decryptContent]);

  const sendMessage = async (
    content: string, 
    type: 'text' | 'image' | 'file' | 'system' = 'text', 
    fileData?: { url: string; name: string; size: number },
    replyToChannelMessageId?: string
  ) => {
    if (!user || !conversationId || !canPublish) return null;
    if (threadId && replyToChannelMessageId !== threadId) throw new Error('Comments must reply to the channel post.');

    let finalContent = type === 'text' || type === 'system' ? content : null;
    let isEncrypted = false;
    let encryptionMetadata: EncryptionMetadata | null = null;

    // Try to encrypt for direct messages
    if (recipientUserId && encryptionReady && type === 'text' && finalContent) {
      try {
        const encrypted = await encryptForUser(finalContent, recipientUserId);
        if (encrypted) {
          finalContent = encrypted.encryptedContent;
          encryptionMetadata = encrypted.metadata;
          isEncrypted = true;
          console.log('🔐 Message encrypted for E2EE');
        }
      } catch (err) {
        console.warn('Failed to encrypt message, sending unencrypted:', err);
      }
    }

    const messageData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: finalContent,
      message_type: type,
      is_encrypted: isEncrypted,
      encryption_metadata: encryptionMetadata,
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
    setMessages(previous => previous.some(message => message.id === data.id) ? previous : [...previous, {
      ...data, content, sender: ownProfile || { user_id: user.id } as Profile, commentCount: 0,
      message_type: data.message_type as MessageWithSender['message_type'],
    }]);

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number } | null> => {
    if (!user) return null;

    // Define allowed MIME types and their valid extensions
    const ALLOWED_TYPES: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'audio/mpeg': ['.mp3'],
      'audio/webm': ['.webm'],
      'audio/ogg': ['.ogg'],
      'audio/wav': ['.wav'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    };

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB general limit
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images

    // Validate MIME type
    if (!ALLOWED_TYPES[file.type]) {
      console.error('File type not allowed:', file.type);
      return null;
    }

    // Validate extension matches MIME type
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_TYPES[file.type].includes(fileExt)) {
      console.error('File extension does not match MIME type:', fileExt, file.type);
      return null;
    }

    // Validate file size based on type
    const maxSize = file.type.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      console.error('File too large:', file.size, 'max:', maxSize);
      return null;
    }

    const fileName = `${user.id}/${Date.now()}${fileExt}`;

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

  const updateMessage = async (message: MessageWithSender, content: string, replacement?: File) => {
    if (!canPublish) throw new Error('Only admins can share or edit channel posts.');
    if (!user || message.conversation_id !== conversationId) throw new Error('Conversation unavailable.');
    let finalContent = content.trim() || null;
    let metadata: EncryptionMetadata | null = null;
    if (message.is_encrypted) {
      if (!recipientUserId || !encryptionReady || !finalContent) throw new Error('Unlock encryption before editing this message.');
      const encrypted = await encryptForUser(finalContent, recipientUserId);
      if (!encrypted) throw new Error('Unable to encrypt the edited message.');
      finalContent = encrypted.encryptedContent;
      metadata = encrypted.metadata;
    }
    const patch: any = { content: finalContent, is_encrypted: !!metadata, encryption_metadata: metadata };
    if (replacement) {
      const uploaded = await uploadFile(replacement);
      if (!uploaded) throw new Error('Upload failed. Use a supported file (images up to 10 MB, other files up to 25 MB).');
      Object.assign(patch, { file_url: uploaded.url, file_name: uploaded.name, file_size: uploaded.size, message_type: replacement.type.startsWith('image/') ? 'image' : 'file' });
    }
    const { data, error } = await supabase.from('messages').update(patch).eq('id', message.id).eq('conversation_id', conversationId!).select('id').single();
    if (error || !data) throw error || new Error('Message could not be updated.');
    setMessages(previous => previous.map(row => row.id === message.id ? { ...row, ...patch, content: content.trim() || null } : row));
    void refetch();
  };

  return { messages, loading, error, sendMessage, uploadFile, updateMessage, refetch, loadOlder, hasOlder, loadingOlder };
}
