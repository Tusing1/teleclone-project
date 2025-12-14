-- Drop the buggy update policy
DROP POLICY IF EXISTS "Admins can update their conversations" ON public.conversations;

-- Create fixed update policy
CREATE POLICY "Admins can update their conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id 
      AND cp.user_id = auth.uid() 
      AND cp.role = ANY (ARRAY['admin'::text, 'owner'::text])
  )
);