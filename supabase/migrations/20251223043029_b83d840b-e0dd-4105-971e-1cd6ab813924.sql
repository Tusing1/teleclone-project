-- Add 'system' as a valid message_type value
-- Since message_type is a text column, we just need to ensure our code handles it

-- No schema changes needed as message_type is already a text column
-- We'll just document that 'system' is now a valid value alongside 'text', 'image', 'file'

-- Add a comment for documentation
COMMENT ON COLUMN public.messages.message_type IS 'Message types: text, image, file, system';