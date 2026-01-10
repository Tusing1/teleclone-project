import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MessageWithSender, Profile } from '@/types/chat';
import { useEncryption } from './useEncryption';
import { EncryptionMetadata } from '@/lib/encryption';

export function useMessages(
  conversationId: string | null, 
  linkedDiscussionId?: string | null,
  recipientUserId?: string | null // For direct messages to enable E2EE
) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
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

    // Decrypt encrypted messages
    const decryptedMessages = await Promise.all(
      messagesData.map(async (msg) => {
        let content = msg.content;
        
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

    setMessages(decryptedMessages);
    setLoading(false);

    // Mark unread messages from others as read
    const unreadMessageIds = messagesData
      .filter(m => m.sender_id !== user?.id && !m.is_read)
      .map(m => m.id);

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', unreadMessageIds);
    }

    // Record views for messages from others (uses unique view tracking)
    const messagesToRecordView = messagesData
      .filter(m => m.sender_id !== user?.id)
      .map(m => m.id);

    if (messagesToRecordView.length > 0 && user?.id) {
      // Record view for each message (function handles duplicates)
      for (const msgId of messagesToRecordView) {
        try {
          await supabase.rpc('record_message_view', { 
            p_message_id: msgId, 
            p_user_id: user.id 
          });
        } catch (err) {
          console.error('Failed to record view for message:', msgId, err);
        }
      }
    }
  }, [conversationId, fetchCommentCounts, user, encryptionReady, decryptContent]);

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

          // Decrypt if encrypted
          let content = newMessage.content;
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

          setMessages(prev => [...prev, messageWithSender]);

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
          const updatedMessage = payload.new as any;
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id 
              ? { ...msg, ...updatedMessage }
              : msg
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, encryptionReady, decryptContent]);

  const sendMessage = async (
    content: string, 
    type: 'text' | 'image' | 'file' | 'system' = 'text', 
    fileData?: { url: string; name: string; size: number },
    replyToChannelMessageId?: string
  ) => {
    if (!user || !conversationId) return null;

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

  return { messages, loading, sendMessage, uploadFile, refetch: fetchMessages };
}