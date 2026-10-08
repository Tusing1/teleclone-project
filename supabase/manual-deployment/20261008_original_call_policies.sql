-- Read-only snapshot from StudyGram Lovable Cloud on 8 October 2026.
-- Reference only: do not execute automatically. These superseded policies are permissive.
-- Restoring them would reopen global call metadata/signaling visibility.
CREATE POLICY participants_insert ON public.call_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY participants_select ON public.call_participants AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY signals_insert ON public.call_signals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = from_user));
CREATE POLICY signals_select ON public.call_signals AS PERMISSIVE FOR SELECT TO authenticated USING (true);
