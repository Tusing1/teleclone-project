-- Add field to link discussion messages to their source channel message
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_channel_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_channel ON public.messages(reply_to_channel_message_id);