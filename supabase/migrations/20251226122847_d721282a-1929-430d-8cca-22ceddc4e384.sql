-- Add index for faster signal lookups by call_id
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id ON public.call_signals(call_id);

-- Add index for realtime subscription filtering
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id_created ON public.call_signals(call_id, created_at DESC);