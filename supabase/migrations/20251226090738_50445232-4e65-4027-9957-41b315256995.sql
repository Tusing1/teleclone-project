-- Fix 1: Remove the policy that allows non-premium users to see who swiped right on them
DROP POLICY IF EXISTS "Users can check if someone swiped right on them" ON public.user_swipes;

-- Fix 2: Update conversation_participants insert policy to require proper authorization
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;

-- Create proper policies for adding participants
-- 1. Users can add themselves to public channels
CREATE POLICY "Users can join public channels" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id 
    AND c.type = 'channel'
  )
);

-- 2. Conversation creators/admins can add other participants
CREATE POLICY "Admins can add participants to conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('owner', 'admin')
  )
);

-- 3. Users can be added to DM conversations they're part of (for new DM creation)
CREATE POLICY "Users can create DM conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id 
    AND c.type = 'direct'
    AND c.created_by = auth.uid()
  )
);

-- 4. Users can join via invite links (handled by checking invite_link_uses)
CREATE POLICY "Users can join via valid invite links" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM channel_invite_links il
    WHERE il.conversation_id = conversation_participants.conversation_id
    AND il.is_active = true
    AND (il.expires_at IS NULL OR il.expires_at > now())
    AND (il.max_uses IS NULL OR il.uses_count < il.max_uses)
  )
);

-- 5. Allow users to join groups they were matched with
CREATE POLICY "Users can join matched conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM user_matches um
    WHERE um.conversation_id = conversation_participants.conversation_id
    AND (um.user1_id = auth.uid() OR um.user2_id = auth.uid())
  )
);