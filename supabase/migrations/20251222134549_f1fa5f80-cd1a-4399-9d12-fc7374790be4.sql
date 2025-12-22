-- Add hand_raised column for the hand-raise feature in live streams
ALTER TABLE public.call_participants ADD COLUMN IF NOT EXISTS hand_raised boolean DEFAULT false;

-- Add livestream_title column to calls table for editing title during stream
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS livestream_title text;

-- Add noise_suppression and network_enhancement settings
ALTER TABLE public.call_participants ADD COLUMN IF NOT EXISTS noise_suppression boolean DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_participants_hand_raised ON public.call_participants(call_id, hand_raised) WHERE hand_raised = true;