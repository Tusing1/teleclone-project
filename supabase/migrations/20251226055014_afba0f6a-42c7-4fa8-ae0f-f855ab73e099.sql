-- Create call_signals table for WebRTC signaling
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user UUID NOT NULL,
  to_user UUID,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Policies for call signals
CREATE POLICY "Users can send signals in their calls"
ON public.call_signals
FOR INSERT
WITH CHECK (
  auth.uid() = from_user AND
  EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view signals in their calls"
ON public.call_signals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own signals"
ON public.call_signals
FOR DELETE
USING (from_user = auth.uid());

-- Enable realtime for call_signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Index for faster queries
CREATE INDEX idx_call_signals_call_id ON public.call_signals(call_id);
CREATE INDEX idx_call_signals_to_user ON public.call_signals(to_user);