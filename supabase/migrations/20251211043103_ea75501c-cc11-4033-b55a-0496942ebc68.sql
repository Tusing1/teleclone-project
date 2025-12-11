-- Add is_archived column to conversations
ALTER TABLE public.conversations ADD COLUMN is_archived boolean DEFAULT false;

-- Add index for archived filter
CREATE INDEX idx_conversations_archived ON public.conversations(is_archived);