-- Snapshot of inspected live policies before the targeted membership/receipt correction.
-- Reference only. Do not replay: these definitions contain verified authorization defects.
CREATE POLICY "Authenticated users can add participants" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete participants" ON public.conversation_participants FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = cp.conversation_id AND cp.user_id = auth.uid() AND cp.role IN ('admin','owner')));
CREATE POLICY "Admins can update participant roles" ON public.conversation_participants FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid() AND cp.role IN ('admin','owner')));
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can view message views" ON public.message_views FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own views" ON public.message_views FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
