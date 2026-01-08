-- Create table to store user public keys for E2EE
CREATE TABLE public.user_encryption_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  key_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read public keys (needed for encryption)
CREATE POLICY "Authenticated users can read public keys"
ON public.user_encryption_keys
FOR SELECT
TO authenticated
USING (true);

-- Users can only insert/update their own key
CREATE POLICY "Users can insert their own key"
ON public.user_encryption_keys
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own key"
ON public.user_encryption_keys
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add is_encrypted column to messages table
ALTER TABLE public.messages ADD COLUMN is_encrypted BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN encryption_metadata JSONB;