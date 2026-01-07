-- Create function to increment view count atomically
CREATE OR REPLACE FUNCTION public.increment_view_count(message_id UUID, viewer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_sender_id UUID;
BEGIN
  -- Get the sender of the message
  SELECT sender_id INTO message_sender_id FROM messages WHERE id = message_id;
  
  -- Only increment if viewer is not the sender
  IF message_sender_id IS NOT NULL AND message_sender_id != viewer_id THEN
    UPDATE messages 
    SET view_count = COALESCE(view_count, 0) + 1 
    WHERE id = message_id;
  END IF;
END;
$$;

-- Create a table to track unique views per user per message (to avoid duplicate counts)
CREATE TABLE IF NOT EXISTS public.message_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;

-- Policy for inserting views (users can only insert their own views)
CREATE POLICY "Users can insert their own views"
ON public.message_views
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for selecting views (users can see all views for messages they have access to)
CREATE POLICY "Users can view message views"
ON public.message_views
FOR SELECT
USING (true);

-- Create function to record view and increment count (only if not already viewed)
CREATE OR REPLACE FUNCTION public.record_message_view(p_message_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_sender_id UUID;
  already_viewed BOOLEAN;
BEGIN
  -- Get the sender of the message
  SELECT sender_id INTO message_sender_id FROM messages WHERE id = p_message_id;
  
  -- Don't count views from message sender
  IF message_sender_id IS NULL OR message_sender_id = p_user_id THEN
    RETURN false;
  END IF;
  
  -- Check if already viewed
  SELECT EXISTS(
    SELECT 1 FROM message_views 
    WHERE message_id = p_message_id AND user_id = p_user_id
  ) INTO already_viewed;
  
  IF already_viewed THEN
    RETURN false;
  END IF;
  
  -- Insert view record
  INSERT INTO message_views (message_id, user_id)
  VALUES (p_message_id, p_user_id)
  ON CONFLICT (message_id, user_id) DO NOTHING;
  
  -- Increment view count
  UPDATE messages 
  SET view_count = COALESCE(view_count, 0) + 1 
  WHERE id = p_message_id;
  
  RETURN true;
END;
$$;