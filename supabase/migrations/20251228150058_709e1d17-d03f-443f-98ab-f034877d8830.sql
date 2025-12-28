-- Fix RLS policy for conversation_participants to allow adding participants
-- This fixes the 403 Forbidden error when creating conversations

DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);