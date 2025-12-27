-- Add name column to channel_invite_links
ALTER TABLE public.channel_invite_links 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Consolidated secure function to get invite details AND conversation preview
-- Use this instead of get_invite_by_code to avoid RLS issues with conversations table
CREATE OR REPLACE FUNCTION public.get_invite_details(invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_conv RECORD;
  v_is_member BOOLEAN;
  v_result JSONB;
BEGIN
  -- 1. Get invite link
  SELECT * INTO v_link
  FROM public.channel_invite_links
  WHERE code = invite_code;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Get conversation details (bypassing RLS)
  SELECT id, name, type, description, avatar_url, subscriber_count 
  INTO v_conv
  FROM public.conversations
  WHERE id = v_link.conversation_id;

  -- 3. Check membership (if user is authenticated)
  v_is_member := FALSE;
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = v_link.conversation_id 
      AND user_id = auth.uid()
    ) INTO v_is_member;
  END IF;

  -- 4. Construct JSON response
  v_result := jsonb_build_object(
    'invite', to_jsonb(v_link),
    'conversation', jsonb_build_object(
      'id', v_conv.id,
      'name', v_conv.name,
      'type', v_conv.type,
      'description', v_conv.description,
      'avatar_url', v_conv.avatar_url,
      'subscriber_count', v_conv.subscriber_count
    ),
    'is_member', v_is_member
  );

  RETURN v_result;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_invite_details(TEXT) TO anon, authenticated, service_role;

-- Secure function to join a channel using an invite code
CREATE OR REPLACE FUNCTION public.join_channel_with_invite_code(invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify link
  SELECT * INTO v_link FROM public.channel_invite_links WHERE code = invite_code;
  
  IF v_link IS NULL THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF NOT v_link.is_active THEN
    RAISE EXCEPTION 'This invite link has been disabled by the administrator';
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'This invite link has expired';
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.uses_count >= v_link.max_uses THEN
    RAISE EXCEPTION 'This invite link has reached its maximum uses';
  END IF;

  -- Check if already member
  IF EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = v_link.conversation_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', true, 'conversation_id', v_link.conversation_id, 'already_member', true);
  END IF;

  -- Add participant
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (v_link.conversation_id, v_user_id, 'member');

  -- Record usage
  INSERT INTO invite_link_uses (invite_link_id, user_id)
  VALUES (v_link.id, v_user_id);

  -- Update uses count
  UPDATE channel_invite_links
  SET uses_count = uses_count + 1
  WHERE id = v_link.id;

  -- Update subscriber count (best effort)
  UPDATE conversations
  SET subscriber_count = COALESCE(subscriber_count, 0) + 1
  WHERE id = v_link.conversation_id AND type = 'channel';

  RETURN jsonb_build_object('success', true, 'conversation_id', v_link.conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_channel_with_invite_code(TEXT) TO authenticated;