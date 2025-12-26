-- Add referred_by column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(user_id);

-- Create user_referrals table to track who invited whom
CREATE TABLE public.user_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

-- Create study_tokens table for user token balances
CREATE TABLE public.study_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create token_transactions table to track how tokens were earned/spent
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'spend')),
  activity_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_referrals
CREATE POLICY "Users can view their own referrals"
  ON public.user_referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can create referrals"
  ON public.user_referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id);

-- RLS policies for study_tokens
CREATE POLICY "Users can view their own tokens"
  ON public.study_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.study_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.study_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for token_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
  ON public.token_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to initialize tokens for new users
CREATE OR REPLACE FUNCTION public.initialize_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.study_tokens (user_id, balance, total_earned)
  VALUES (NEW.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to initialize tokens when profile is created
CREATE TRIGGER on_profile_created_init_tokens
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_tokens();

-- Create function to award referral tokens
CREATE OR REPLACE FUNCTION public.award_referral_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Award 50 tokens to referrer
  UPDATE public.study_tokens
  SET balance = balance + 50, total_earned = total_earned + 50, updated_at = now()
  WHERE user_id = NEW.referrer_id;
  
  -- Log the transaction for referrer
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, activity_type, description)
  VALUES (NEW.referrer_id, 50, 'earn', 'referral', 'Referred a new user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to award tokens when referral is created
CREATE TRIGGER on_referral_created_award_tokens
  AFTER INSERT ON public.user_referrals
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_tokens();