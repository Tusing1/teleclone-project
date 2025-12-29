-- Add RLS policy to allow users to see calls they recorded
CREATE POLICY "Users can view their own recordings"
ON public.calls
FOR SELECT
USING (recorded_by = auth.uid());