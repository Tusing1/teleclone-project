BEGIN;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.check_channel_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pinned_message_id IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.pinned_message_id IS NOT DISTINCT FROM OLD.pinned_message_id THEN RETURN NEW;
  END IF;
  IF NEW.type <> 'channel' THEN RAISE EXCEPTION 'Only channels support pinned posts'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = NEW.id AND user_id = auth.uid() AND role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Only channel administrators can change a pin';
  END IF;
  IF NEW.pinned_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.messages WHERE id = NEW.pinned_message_id AND conversation_id = NEW.id) THEN
    RAISE EXCEPTION 'Pinned post must belong to this channel';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_channel_pin() FROM PUBLIC;
DROP TRIGGER IF EXISTS enforce_channel_pin ON public.conversations;
CREATE TRIGGER enforce_channel_pin BEFORE INSERT OR UPDATE OF pinned_message_id ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.check_channel_pin();
COMMIT;
