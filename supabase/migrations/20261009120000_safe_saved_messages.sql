BEGIN;
CREATE OR REPLACE FUNCTION public.get_or_create_saved_messages()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); saved_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in to open Saved Messages'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('studygram-saved-' || actor::text, 0));
  SELECT c.id INTO saved_id FROM public.conversations c
    WHERE c.type = 'direct'
      AND EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = actor)
      AND (SELECT count(*) FROM public.conversation_participants p WHERE p.conversation_id = c.id) = 1
    ORDER BY c.created_at, c.id LIMIT 1;
  IF saved_id IS NOT NULL THEN RETURN saved_id; END IF;
  INSERT INTO public.conversations (type, name, created_by) VALUES ('direct', NULL, actor) RETURNING id INTO saved_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id, role) VALUES (saved_id, actor, 'owner');
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_saved_messages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_saved_messages() TO authenticated;
COMMIT;
