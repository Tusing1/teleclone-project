-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Create a permissive insert policy
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);