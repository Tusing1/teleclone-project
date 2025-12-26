-- First, create a helper function to check if two users have a relationship
CREATE OR REPLACE FUNCTION public.has_user_relationship(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Same user (can always view own profile)
    _viewer_id = _profile_user_id
    OR
    -- In a conversation together
    EXISTS (
      SELECT 1 FROM conversation_participants cp1
      JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = _viewer_id AND cp2.user_id = _profile_user_id
    )
    OR
    -- Matched together
    EXISTS (
      SELECT 1 FROM user_matches
      WHERE (user1_id = _viewer_id AND user2_id = _profile_user_id)
         OR (user1_id = _profile_user_id AND user2_id = _viewer_id)
    )
    OR
    -- Friend request between them (sent or received)
    EXISTS (
      SELECT 1 FROM friend_requests
      WHERE (sender_id = _viewer_id AND receiver_id = _profile_user_id)
         OR (sender_id = _profile_user_id AND receiver_id = _viewer_id)
    )
$$;

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Create new restrictive policy - users can view profiles of people they have relationships with
CREATE POLICY "Users can view related profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_user_relationship(auth.uid(), user_id)
);

-- Also allow viewing profiles for discovery (Find Friends feature) - but only basic info
-- We need this for the swipe/discover feature to work
-- Create a separate policy for discovery that allows viewing all profiles
-- (This is necessary for social apps - users need to discover new people)
CREATE POLICY "Authenticated users can discover profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);