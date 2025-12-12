-- Create table for active calls
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('voice', 'video')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create table for call participants
CREATE TABLE public.call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_video_off BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(call_id, user_id)
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for calls
CREATE POLICY "Users can view calls in their conversations"
ON public.calls FOR SELECT
TO authenticated
USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Conversation admins can create calls"
ON public.calls FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = calls.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Call starter can update call"
ON public.calls FOR UPDATE
TO authenticated
USING (started_by = auth.uid());

-- RLS policies for call participants
CREATE POLICY "Users can view call participants"
ON public.call_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM calls c
    WHERE c.id = call_participants.call_id
    AND is_conversation_member(auth.uid(), c.conversation_id)
  )
);

CREATE POLICY "Users can join calls in their conversations"
ON public.call_participants FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM calls c
    WHERE c.id = call_participants.call_id
    AND c.is_active = true
    AND is_conversation_member(auth.uid(), c.conversation_id)
  )
);

CREATE POLICY "Users can update their own participation"
ON public.call_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;