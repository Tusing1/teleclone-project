-- Allow admins/owners to delete conversations
CREATE POLICY "Admins can delete their conversations" 
ON public.conversations 
FOR DELETE 
USING (EXISTS (
  SELECT 1
  FROM conversation_participants cp
  WHERE cp.conversation_id = conversations.id 
    AND cp.user_id = auth.uid() 
    AND cp.role = ANY (ARRAY['admin'::text, 'owner'::text])
));