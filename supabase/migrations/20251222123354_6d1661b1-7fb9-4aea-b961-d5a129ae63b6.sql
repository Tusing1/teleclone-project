-- Allow admins to update participant roles
CREATE POLICY "Admins can update participant roles" ON public.conversation_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );