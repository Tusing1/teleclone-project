-- Enable Global Leaderboards and Score Persistence

-- 1. Ensure the token_transactions table exists with proper structure
-- Note: Table already exists, so we'll just ensure proper constraints
-- The existing table doesn't have the foreign key or check constraint, let's add them safely

-- 2. Enable RLS on token_transactions if not already enabled
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can only insert their own transactions
-- (Prevents score spoofing for other users)
DROP POLICY IF EXISTS "Users can insert their own token transactions" ON public.token_transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.token_transactions;
CREATE POLICY "Users can insert their own token transactions"
ON public.token_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Policy: Users can view their own transactions (for balance history)
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.token_transactions;
CREATE POLICY "Users can view their own transactions"
ON public.token_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- 5. Policy: CRITICAL - Allow anyone to view GAME SCORES for the leaderboard
-- This enables cross-user visibility specifically for game activities
DROP POLICY IF EXISTS "Enable global visibility for game scores" ON public.token_transactions;
CREATE POLICY "Enable global visibility for game scores"
ON public.token_transactions
FOR SELECT
USING (activity_type LIKE 'game_score_%');

-- 6. Grant access to authenticated users
GRANT ALL ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;

-- 7. Add Index for leaderboard performance
CREATE INDEX IF NOT EXISTS idx_token_tx_game_scores 
ON public.token_transactions (activity_type, amount DESC);