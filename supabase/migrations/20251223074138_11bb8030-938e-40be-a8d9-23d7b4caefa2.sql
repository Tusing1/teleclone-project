-- Create table for tracking user swipes
CREATE TABLE public.user_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id uuid NOT NULL,
  swiped_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('left', 'right')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, swiped_id)
);

-- Create table for matches (when both swipe right)
CREATE TABLE public.user_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  matched_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user1_id, user2_id)
);

-- Create table for premium features (who liked you visibility)
CREATE TABLE public.premium_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_see_likes boolean NOT NULL DEFAULT false,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_unlocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_swipes
CREATE POLICY "Users can view their own swipes"
ON public.user_swipes FOR SELECT
USING (auth.uid() = swiper_id);

CREATE POLICY "Users can create their own swipes"
ON public.user_swipes FOR INSERT
WITH CHECK (auth.uid() = swiper_id);

-- RLS Policies for user_matches
CREATE POLICY "Users can view their own matches"
ON public.user_matches FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Authenticated users can create matches"
ON public.user_matches FOR INSERT
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- RLS Policies for premium_unlocks
CREATE POLICY "Users can view their own premium status"
ON public.premium_unlocks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own premium status"
ON public.premium_unlocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their premium"
ON public.premium_unlocks FOR UPDATE
USING (auth.uid() = user_id);

-- Policy to allow premium users to see who liked them
CREATE POLICY "Premium users can see who swiped right on them"
ON public.user_swipes FOR SELECT
USING (
  auth.uid() = swiped_id 
  AND direction = 'right'
  AND EXISTS (
    SELECT 1 FROM public.premium_unlocks 
    WHERE user_id = auth.uid() AND can_see_likes = true
  )
);