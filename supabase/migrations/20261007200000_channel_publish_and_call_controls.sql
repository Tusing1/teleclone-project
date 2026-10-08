-- Metadata-only message updates (read/view counts) remain allowed by existing RLS.
CREATE OR REPLACE FUNCTION public.guard_channel_publishing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_channel boolean; actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RETURN NEW; END IF; -- trusted backend only
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.conversation_id <> OLD.conversation_id OR NEW.sender_id <> OLD.sender_id) THEN
    RAISE EXCEPTION 'Message identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.conversation_id = OLD.conversation_id
    AND NEW.sender_id = OLD.sender_id AND NEW.content IS NOT DISTINCT FROM OLD.content
    AND NEW.file_url IS NOT DISTINCT FROM OLD.file_url AND NEW.file_name IS NOT DISTINCT FROM OLD.file_name
    AND NEW.file_size IS NOT DISTINCT FROM OLD.file_size AND NEW.message_type = OLD.message_type
    AND NEW.is_encrypted IS NOT DISTINCT FROM OLD.is_encrypted
    AND NEW.encryption_metadata IS NOT DISTINCT FROM OLD.encryption_metadata
    AND NEW.reply_to_channel_message_id IS NOT DISTINCT FROM OLD.reply_to_channel_message_id
    AND NEW.created_at = OLD.created_at THEN RETURN NEW; END IF;
  SELECT type = 'channel' INTO is_channel FROM public.conversations WHERE id = NEW.conversation_id;
  IF is_channel AND NOT EXISTS (SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id = actor AND role IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Only channel admins can publish or edit posts' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_channel_publishing BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_channel_publishing();

-- Existing permissive UPDATE policies must not let a listener end the host's call.
CREATE OR REPLACE FUNCTION public.guard_call_control()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); kind text;
BEGIN
  IF actor IS NULL THEN RETURN NEW; END IF;
  SELECT type INTO kind FROM public.conversations WHERE id = NEW.conversation_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.started_by <> actor OR NOT public.is_conversation_member(actor, NEW.conversation_id) THEN
      RAISE EXCEPTION 'Invalid call host' USING ERRCODE = '42501';
    END IF;
    IF kind IN ('channel', 'group') AND NOT EXISTS (SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = NEW.conversation_id AND user_id = actor AND role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Only admins can start group/channel calls' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.conversation_id <> OLD.conversation_id OR NEW.started_by <> OLD.started_by THEN
      RAISE EXCEPTION 'Call identity cannot be changed' USING ERRCODE = '42501';
    END IF;
    IF kind <> 'direct' AND actor <> OLD.started_by AND NOT EXISTS (SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = OLD.conversation_id AND user_id = actor AND role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Only the host or an admin can manage this call' USING ERRCODE = '42501';
    END IF;
    IF NOT OLD.is_active AND NEW.is_active THEN RAISE EXCEPTION 'Ended calls cannot be reopened'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_call_control BEFORE INSERT OR UPDATE ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.guard_call_control();

-- Allow joining only a current call in a conversation the user belongs to.
DROP POLICY IF EXISTS participants_insert ON public.call_participants;
CREATE POLICY participants_insert ON public.call_participants FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.calls c
  WHERE c.id = call_id AND c.is_active AND public.is_conversation_member(auth.uid(), c.conversation_id)));
CREATE POLICY participants_host_update ON public.call_participants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND
  (c.started_by = auth.uid() OR EXISTS (SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = c.conversation_id AND p.user_id = auth.uid() AND p.role IN ('owner', 'admin')))))
WITH CHECK (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND
  (c.started_by = auth.uid() OR EXISTS (SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = c.conversation_id AND p.user_id = auth.uid() AND p.role IN ('owner', 'admin')))));

-- A participant cannot move an existing membership to another user/call or rejoin an ended call.
CREATE OR REPLACE FUNCTION public.guard_call_participation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.call_id <> OLD.call_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'Participation identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.left_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.calls c
    WHERE c.id = NEW.call_id AND c.is_active AND public.is_conversation_member(NEW.user_id, c.conversation_id)) THEN
    RAISE EXCEPTION 'Call ended or membership is missing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_call_participation BEFORE INSERT OR UPDATE ON public.call_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_call_participation();

-- The former global read policies exposed every call's participants and SDP to any signed-in user.
DROP POLICY IF EXISTS participants_select ON public.call_participants;
CREATE POLICY participants_select ON public.call_participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id
  AND public.is_conversation_member(auth.uid(), c.conversation_id)));
DROP POLICY IF EXISTS signals_select ON public.call_signals;
CREATE POLICY signals_select ON public.call_signals FOR SELECT TO authenticated
USING ((to_user = auth.uid() OR from_user = auth.uid()) AND EXISTS (
  SELECT 1 FROM public.calls c WHERE c.id = call_id AND public.is_conversation_member(auth.uid(), c.conversation_id)));
DROP POLICY IF EXISTS signals_insert ON public.call_signals;
CREATE POLICY signals_insert ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (from_user = auth.uid() AND EXISTS (SELECT 1 FROM public.calls c
  WHERE c.id = call_id AND c.is_active
  AND public.is_conversation_member(auth.uid(), c.conversation_id)
  AND public.is_conversation_member(to_user, c.conversation_id)));
