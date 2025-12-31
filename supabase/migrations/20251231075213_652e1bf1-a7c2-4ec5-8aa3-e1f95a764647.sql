-- CALL STABILIZATION "SUPER FIX"
-- Resolve "403 Forbidden" errors

-- 1. Table cleanup (ensure defaults are helpful)
ALTER TABLE public.calls ALTER COLUMN is_active SET DEFAULT true;

-- 2. Drop all conflicting policies to start fresh
DROP POLICY IF EXISTS "Conversation members can create calls" ON public.calls;
DROP POLICY IF EXISTS "Call starter can update call" ON public.calls;
DROP POLICY IF EXISTS "Participants can update their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls in their conversations" ON public.calls;
DROP POLICY IF EXISTS "Users can view their own recordings" ON public.calls;
DROP POLICY IF EXISTS "calls_select" ON public.calls;
DROP POLICY IF EXISTS "calls_insert" ON public.calls;
DROP POLICY IF EXISTS "calls_update" ON public.calls;

DROP POLICY IF EXISTS "Users can view call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Users can join calls in their conversations" ON public.call_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.call_participants;
DROP POLICY IF EXISTS "participants_select" ON public.call_participants;
DROP POLICY IF EXISTS "participants_insert" ON public.call_participants;
DROP POLICY IF EXISTS "participants_update" ON public.call_participants;

DROP POLICY IF EXISTS "Users can send signals in their calls" ON public.call_signals;
DROP POLICY IF EXISTS "Users can view signals in their calls" ON public.call_signals;
DROP POLICY IF EXISTS "Users can delete their own signals" ON public.call_signals;
DROP POLICY IF EXISTS "Participants can send signals" ON public.call_signals;
DROP POLICY IF EXISTS "Participants can view signals" ON public.call_signals;
DROP POLICY IF EXISTS "signals_select" ON public.call_signals;
DROP POLICY IF EXISTS "signals_insert" ON public.call_signals;
DROP POLICY IF EXISTS "signals_delete" ON public.call_signals;

-- 3. Simplified, Robust Policies for Calls
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated
WITH CHECK (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated
USING (is_conversation_member(auth.uid(), conversation_id));

-- 4. Simplified, Robust Policies for Participants
CREATE POLICY "participants_select" ON public.call_participants FOR SELECT TO authenticated
USING (true);

CREATE POLICY "participants_insert" ON public.call_participants FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "participants_update" ON public.call_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 5. Simplified, Robust Policies for Signals
CREATE POLICY "signals_select" ON public.call_signals FOR SELECT TO authenticated
USING (true);

CREATE POLICY "signals_insert" ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = from_user);

CREATE POLICY "signals_delete" ON public.call_signals FOR DELETE TO authenticated
USING (auth.uid() = from_user);