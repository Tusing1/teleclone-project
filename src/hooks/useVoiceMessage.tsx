import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UseVoiceMessageOptions {
  conversationId: string;
  replyToChannelMessageId?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useVoiceMessage({ conversationId, replyToChannelMessageId, onSuccess, onError }: UseVoiceMessageOptions) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const sendVoiceMessage = useCallback(async (blob: Blob, duration: number) => {
    if (!user || !conversationId) return;

    setIsUploading(true);

    try {
      // Generate filename with timestamp
      const timestamp = Date.now();
      const fileName = `voice_${timestamp}.webm`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Create message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: `🎤 Voice message (${formatDuration(duration)})`,
          message_type: 'file',
          file_url: publicUrl,
          file_name: fileName,
          file_size: blob.size,
          reply_to_channel_message_id: replyToChannelMessageId || null,
        });

      if (messageError) throw messageError;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      onSuccess?.();
    } catch (error) {
      console.error('Error sending voice message:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to send voice message'));
    } finally {
      setIsUploading(false);
    }
  }, [user, conversationId, replyToChannelMessageId, onSuccess, onError]);

  return {
    sendVoiceMessage,
    isUploading,
  };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
