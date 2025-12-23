-- Allow users to check if someone swiped right on them (needed for match detection)
CREATE POLICY "Users can check if someone swiped right on them"
ON public.user_swipes
FOR SELECT
USING (
  auth.uid() = swiped_id 
  AND direction = 'right'
);