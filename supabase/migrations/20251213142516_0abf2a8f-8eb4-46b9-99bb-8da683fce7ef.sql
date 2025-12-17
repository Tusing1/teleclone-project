-- Add linked_discussion_id to conversations for channel-discussion linking
ALTER TABLE public.conversations 
ADD COLUMN linked_discussion_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_conversations_linked_discussion ON public.conversations(linked_discussion_id) WHERE linked_discussion_id IS NOT NULL;

-- Add subscriber_count for channels (cached count)
ALTER TABLE public.conversations
ADD COLUMN subscriber_count integer DEFAULT 0;

-- Update RLS to allow members to view linked discussions
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
  OR EXISTS (
    -- Also return true if user is member of parent channel (for discussion access)
    SELECT 1
    FROM public.conversations c
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.linked_discussion_id = _conversation_id
      AND cp.user_id = _user_id
  )
$$;