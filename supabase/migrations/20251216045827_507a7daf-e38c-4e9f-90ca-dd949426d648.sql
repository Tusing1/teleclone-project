-- Add recording fields to calls table
ALTER TABLE public.calls
ADD COLUMN is_recording boolean NOT NULL DEFAULT false,
ADD COLUMN recording_title text,
ADD COLUMN recording_url text,
ADD COLUMN recorded_by uuid;