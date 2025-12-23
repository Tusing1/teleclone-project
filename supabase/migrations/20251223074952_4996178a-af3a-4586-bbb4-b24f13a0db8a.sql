-- Add interests column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN interests text[] DEFAULT '{}';

-- Create a table for predefined interest categories
CREATE TABLE public.interest_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interest_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view interest categories
CREATE POLICY "Anyone can view interest categories"
ON public.interest_categories FOR SELECT
USING (true);

-- Insert some default interests
INSERT INTO public.interest_categories (name, emoji) VALUES
  ('Music', '🎵'),
  ('Movies', '🎬'),
  ('Gaming', '🎮'),
  ('Sports', '⚽'),
  ('Travel', '✈️'),
  ('Food', '🍕'),
  ('Art', '🎨'),
  ('Books', '📚'),
  ('Tech', '💻'),
  ('Fitness', '💪'),
  ('Photography', '📷'),
  ('Fashion', '👗'),
  ('Nature', '🌿'),
  ('Pets', '🐾'),
  ('Cooking', '👨‍🍳'),
  ('Dancing', '💃'),
  ('Comedy', '😂'),
  ('Science', '🔬'),
  ('Business', '💼'),
  ('Anime', '🎌');