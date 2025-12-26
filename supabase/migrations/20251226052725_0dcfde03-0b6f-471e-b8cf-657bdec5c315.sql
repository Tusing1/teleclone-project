-- Add phone_number column to profiles table for contact-based discovery
ALTER TABLE public.profiles 
ADD COLUMN phone_number TEXT;

-- Create a unique index on phone_number (allowing nulls)
CREATE UNIQUE INDEX idx_profiles_phone_number ON public.profiles (phone_number) 
WHERE phone_number IS NOT NULL;