-- Allow participants in direct chats to start calls (not just admins/owners)
DROP POLICY IF EXISTS "Conversation admins can create calls" ON public.calls;

CREATE POLICY "Conversation members can create calls"
ON public.calls
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversation_participants cp
    WHERE cp.conversation_id = calls.conversation_id
    AND cp.user_id = auth.uid()
  )
);