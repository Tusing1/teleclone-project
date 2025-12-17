-- Add conversation type and metadata
ALTER TABLE public.conversations 
ADD COLUMN type text NOT NULL DEFAULT 'direct',
ADD COLUMN name text,
ADD COLUMN description text,
ADD COLUMN avatar_url text,
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Add role to participants for groups/channels
ALTER TABLE public.conversation_participants
ADD COLUMN role text NOT NULL DEFAULT 'member';

-- Create index for conversation type
CREATE INDEX idx_conversations_type ON public.conversations(type);

-- Update RLS policy for conversations to allow updates by admins/owners
CREATE POLICY "Admins can update their conversations"
ON public.conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = id 
    AND cp.user_id = auth.uid()
    AND cp.role IN ('admin', 'owner')
  )
);

-- Allow participants to be removed by admins
CREATE POLICY "Admins can delete participants"
ON public.conversation_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('admin', 'owner')
  )
);