-- Apply only after approval; all changes are atomic. Existing rows are retained.
BEGIN;
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261008120000') THEN
    RAISE EXCEPTION 'Membership correction already recorded; inspect before reapplying';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND
    ((tablename='conversation_participants' AND policyname IN ('Authenticated users can add participants','Admins can delete participants','Admins can update participant roles'))
    OR (tablename='conversations' AND policyname='Authenticated users can create conversations')
    OR (tablename='message_views' AND policyname IN ('Users can view message views','Users can insert their own views')))) <> 6 THEN
    RAISE EXCEPTION 'Hosted policy set changed; stop and reconcile';
  END IF;
END;
$preflight$;
-- Narrow fixes for verified hosted policies. Preserve users/messages/files and invite RPCs.
-- New DMs, saved chats and group/channel bootstrap use the authenticated create-conversation endpoint.
CREATE OR REPLACE FUNCTION public.conversation_actor_role(target_conversation uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.role FROM public.conversation_participants cp
  WHERE cp.conversation_id = target_conversation AND cp.user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.conversation_actor_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_actor_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;
CREATE POLICY "Conversation admins can add members" ON public.conversation_participants
FOR INSERT TO authenticated WITH CHECK (
  public.conversation_actor_role(conversation_id) IN ('owner','admin')
  AND role IN ('member','admin')
);

DROP POLICY IF EXISTS "Admins can delete participants" ON public.conversation_participants;
CREATE POLICY "Members can leave or admins can remove members" ON public.conversation_participants
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR (public.conversation_actor_role(conversation_id) IN ('owner','admin')
      AND (role <> 'owner' OR public.conversation_actor_role(conversation_id) = 'owner'))
);

DROP POLICY IF EXISTS "Admins can update participant roles" ON public.conversation_participants;
CREATE POLICY "Conversation admins can manage member roles" ON public.conversation_participants
FOR UPDATE TO authenticated
USING (public.conversation_actor_role(conversation_id) IN ('owner','admin'))
WITH CHECK (public.conversation_actor_role(conversation_id) IN ('owner','admin') AND role IN ('owner','admin','member'));

CREATE OR REPLACE FUNCTION public.guard_membership_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'Membership identity cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF current_user = 'authenticated' AND (OLD.role = 'owner' OR NEW.role = 'owner')
     AND public.conversation_actor_role(OLD.conversation_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can change ownership' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_membership_identity BEFORE UPDATE ON public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_membership_identity();

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Users can create their own conversations" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view message views" ON public.message_views;
CREATE POLICY "Members can view receipts in their conversations" ON public.message_views
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
    AND public.is_conversation_member(auth.uid(), m.conversation_id))
);
DROP POLICY IF EXISTS "Users can insert their own views" ON public.message_views;
CREATE POLICY "Members can record their own receipts" ON public.message_views
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
    AND public.is_conversation_member(auth.uid(), m.conversation_id))
);
-- Public encryption keys and interest categories intentionally remain readable.
INSERT INTO supabase_migrations.schema_migrations (version,name,statements)
VALUES ('20261008120000','membership_access_controls',ARRAY[$migration_source$-- Narrow fixes for verified hosted policies. Preserve users/messages/files and invite RPCs.
-- New DMs, saved chats and group/channel bootstrap use the authenticated create-conversation endpoint.
CREATE OR REPLACE FUNCTION public.conversation_actor_role(target_conversation uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.role FROM public.conversation_participants cp
  WHERE cp.conversation_id = target_conversation AND cp.user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.conversation_actor_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_actor_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;
CREATE POLICY "Conversation admins can add members" ON public.conversation_participants
FOR INSERT TO authenticated WITH CHECK (
  public.conversation_actor_role(conversation_id) IN ('owner','admin')
  AND role IN ('member','admin')
);

DROP POLICY IF EXISTS "Admins can delete participants" ON public.conversation_participants;
CREATE POLICY "Members can leave or admins can remove members" ON public.conversation_participants
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR (public.conversation_actor_role(conversation_id) IN ('owner','admin')
      AND (role <> 'owner' OR public.conversation_actor_role(conversation_id) = 'owner'))
);

DROP POLICY IF EXISTS "Admins can update participant roles" ON public.conversation_participants;
CREATE POLICY "Conversation admins can manage member roles" ON public.conversation_participants
FOR UPDATE TO authenticated
USING (public.conversation_actor_role(conversation_id) IN ('owner','admin'))
WITH CHECK (public.conversation_actor_role(conversation_id) IN ('owner','admin') AND role IN ('owner','admin','member'));

CREATE OR REPLACE FUNCTION public.guard_membership_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'Membership identity cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF current_user = 'authenticated' AND (OLD.role = 'owner' OR NEW.role = 'owner')
     AND public.conversation_actor_role(OLD.conversation_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can change ownership' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_membership_identity BEFORE UPDATE ON public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_membership_identity();

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Users can create their own conversations" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view message views" ON public.message_views;
CREATE POLICY "Members can view receipts in their conversations" ON public.message_views
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
    AND public.is_conversation_member(auth.uid(), m.conversation_id))
);
DROP POLICY IF EXISTS "Users can insert their own views" ON public.message_views;
CREATE POLICY "Members can record their own receipts" ON public.message_views
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id
    AND public.is_conversation_member(auth.uid(), m.conversation_id))
);
-- Public encryption keys and interest categories intentionally remain readable.$migration_source$]);
COMMIT;
SELECT
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname IN
 ('Conversation admins can add members','Members can leave or admins can remove members','Conversation admins can manage member roles',
 'Users can create their own conversations','Members can view receipts in their conversations','Members can record their own receipts')) AS scoped_policies,
 (SELECT count(*) FROM pg_trigger WHERE tgname='guard_membership_identity' AND tgenabled='O') AS identity_guards,
 (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261008120000') AS migration_records;
