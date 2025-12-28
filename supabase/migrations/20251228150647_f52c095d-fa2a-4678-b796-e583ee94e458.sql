-- Drop ALL conflicting INSERT policies on conversation_participants
-- and ensure the new permissive one works

DROP POLICY IF EXISTS "Admins can add participants to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can create DM conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join matched conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join public channels" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join via valid invite links" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;

-- Create a single permissive INSERT policy
CREATE POLICY "Authenticated users can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);