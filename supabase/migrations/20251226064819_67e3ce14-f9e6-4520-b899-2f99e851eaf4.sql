-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all token_purchases
CREATE POLICY "Admins can view all purchases"
ON public.token_purchases FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any token_purchase
CREATE POLICY "Admins can update all purchases"
ON public.token_purchases FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add expires_at column to token_purchases for countdown feature
ALTER TABLE public.token_purchases 
ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 minutes');

-- Allow admins to award tokens to users (update study_tokens)
CREATE POLICY "Admins can update any user tokens"
ON public.study_tokens FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert transactions for any user
CREATE POLICY "Admins can create transactions for users"
ON public.token_transactions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));