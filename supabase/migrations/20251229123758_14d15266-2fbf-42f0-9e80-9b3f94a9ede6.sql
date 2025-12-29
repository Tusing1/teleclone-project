-- Add index for efficient recording queries
CREATE INDEX IF NOT EXISTS idx_calls_recordings ON public.calls (recorded_by, ended_at DESC) WHERE recording_url IS NOT NULL;

-- Create a view for easier access to recordings data
CREATE OR REPLACE VIEW public.user_recordings AS
SELECT 
  c.id,
  c.conversation_id,
  c.started_by,
  c.started_at,
  c.ended_at,
  c.call_type,
  c.recording_url,
  c.recording_title,
  c.recorded_by,
  c.livestream_title,
  conv.name as conversation_name,
  conv.type as conversation_type
FROM public.calls c
LEFT JOIN public.conversations conv ON c.conversation_id = conv.id
WHERE c.recording_url IS NOT NULL;

-- RLS for the view (views inherit from base table policies)
-- Users can only see recordings from calls they were part of or recorded