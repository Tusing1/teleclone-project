-- Create login_streaks table for daily login tracking
CREATE TABLE public.login_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own login streaks"
ON public.login_streaks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login streaks"
ON public.login_streaks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own login streaks"
ON public.login_streaks FOR UPDATE
USING (auth.uid() = user_id);

-- Create token_purchases table for mobile money transactions
CREATE TABLE public.token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_ugx INTEGER NOT NULL,
  tokens INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  activation_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own purchases"
ON public.token_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own purchases"
ON public.token_purchases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchases"
ON public.token_purchases FOR UPDATE
USING (auth.uid() = user_id);

-- Initialize study_tokens for all existing users who don't have one
INSERT INTO public.study_tokens (user_id, balance, total_earned)
SELECT user_id, 0, 0 FROM public.profiles
WHERE user_id NOT IN (SELECT user_id FROM public.study_tokens)
ON CONFLICT (user_id) DO NOTHING;

-- Create trigger to initialize login_streaks for new users
CREATE OR REPLACE FUNCTION public.initialize_user_login_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_streaks (user_id, current_streak, longest_streak)
  VALUES (NEW.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on profiles insert to initialize login streak
CREATE TRIGGER on_profile_created_init_streak
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_login_streak();

-- Initialize login_streaks for existing users
INSERT INTO public.login_streaks (user_id, current_streak, longest_streak)
SELECT user_id, 0, 0 FROM public.profiles
WHERE user_id NOT IN (SELECT user_id FROM public.login_streaks)
ON CONFLICT (user_id) DO NOTHING;