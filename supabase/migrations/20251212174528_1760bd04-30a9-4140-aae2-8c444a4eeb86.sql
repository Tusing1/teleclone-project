-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

-- Create a security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
$$;

-- Recreate the policies using the function
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (public.is_conversation_member(auth.uid(), id));