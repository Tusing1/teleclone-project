-- Run after the correction. Synthetic actors/data are ALWAYS rolled back.
-- An assertion failure aborts the transaction; execute ROLLBACK if the editor leaves it open.
BEGIN;
INSERT INTO auth.users (id,email) VALUES
 ('e8100000-0000-4000-8000-000000000001','membership-owner@example.invalid'),
 ('e8100000-0000-4000-8000-000000000002','membership-member@example.invalid'),
 ('e8100000-0000-4000-8000-000000000003','membership-other-owner@example.invalid'),
 ('e8100000-0000-4000-8000-000000000004','membership-outsider@example.invalid');
INSERT INTO public.conversations (id,type,name,created_by) VALUES
 ('e8100000-0000-4000-8000-000000000101','channel','Rollback probe A','e8100000-0000-4000-8000-000000000001'),
 ('e8100000-0000-4000-8000-000000000102','group','Rollback probe B','e8100000-0000-4000-8000-000000000003');
INSERT INTO public.conversation_participants (conversation_id,user_id,role) VALUES
 ('e8100000-0000-4000-8000-000000000101','e8100000-0000-4000-8000-000000000001','owner'),
 ('e8100000-0000-4000-8000-000000000101','e8100000-0000-4000-8000-000000000002','member'),
 ('e8100000-0000-4000-8000-000000000102','e8100000-0000-4000-8000-000000000003','owner'),
 ('e8100000-0000-4000-8000-000000000102','e8100000-0000-4000-8000-000000000001','member'),
 ('e8100000-0000-4000-8000-000000000102','e8100000-0000-4000-8000-000000000004','member');
INSERT INTO public.messages (id,conversation_id,sender_id,content,message_type) VALUES
 ('e8100000-0000-4000-8000-000000000201','e8100000-0000-4000-8000-000000000101','e8100000-0000-4000-8000-000000000001','Rollback-only receipt probe','text');
INSERT INTO public.message_views (message_id,user_id) VALUES
 ('e8100000-0000-4000-8000-000000000201','e8100000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000004',true);
DO $probe$ BEGIN
  BEGIN
    INSERT INTO public.conversation_participants (conversation_id,user_id,role)
    VALUES ('e8100000-0000-4000-8000-000000000101',auth.uid(),'owner');
    RAISE EXCEPTION 'FAIL: outsider joined a private channel';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.message_views WHERE message_id='e8100000-0000-4000-8000-000000000201') THEN
    RAISE EXCEPTION 'FAIL: outsider read private receipts';
  END IF;
END; $probe$;

SELECT set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000002',true);
DO $probe$ DECLARE affected integer; BEGIN
  UPDATE public.conversation_participants SET role='admin'
  WHERE conversation_id='e8100000-0000-4000-8000-000000000101' AND user_id=auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'FAIL: ordinary member promoted themselves'; END IF;
END; $probe$;

SELECT set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000001',true);
DO $probe$ DECLARE affected integer; BEGIN
  DELETE FROM public.conversation_participants
  WHERE conversation_id='e8100000-0000-4000-8000-000000000102' AND user_id='e8100000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'FAIL: admin rights leaked across conversations'; END IF;
  INSERT INTO public.conversation_participants (conversation_id,user_id,role)
  VALUES ('e8100000-0000-4000-8000-000000000101','e8100000-0000-4000-8000-000000000004','member');
  IF NOT EXISTS (SELECT 1 FROM public.message_views WHERE message_id='e8100000-0000-4000-8000-000000000201') THEN
    RAISE EXCEPTION 'FAIL: authorized owner cannot read receipts';
  END IF;
  BEGIN
    UPDATE public.conversation_participants SET user_id='e8100000-0000-4000-8000-000000000003'
    WHERE conversation_id='e8100000-0000-4000-8000-000000000101' AND user_id='e8100000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'FAIL: membership identity changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.conversation_participants SET role='admin'
  WHERE conversation_id='e8100000-0000-4000-8000-000000000101' AND user_id='e8100000-0000-4000-8000-000000000002';
END; $probe$;

SELECT set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000002',true);
DO $probe$ BEGIN
  BEGIN
    UPDATE public.conversation_participants SET role='owner'
    WHERE conversation_id='e8100000-0000-4000-8000-000000000101' AND user_id=auth.uid();
    RAISE EXCEPTION 'FAIL: admin took ownership';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $probe$;

SET LOCAL ROLE anon;
DO $probe$ BEGIN
  IF EXISTS (SELECT 1 FROM public.message_views WHERE message_id='e8100000-0000-4000-8000-000000000201') THEN
    RAISE EXCEPTION 'FAIL: anonymous user read private receipts';
  END IF;
END; $probe$;
RESET ROLE;
ROLLBACK;
SELECT 'All membership assertions passed; synthetic actors and data rolled back' AS verification;
