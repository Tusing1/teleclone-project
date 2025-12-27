-- Add name column to channel_invite_links
ALTER TABLE public.channel_invite_links 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create a secure function to validate invite links (bypassing RLS for details)
CREATE OR REPLACE FUNCTION public.get_invite_by_code(invite_code TEXT)
RETURNS SETOF public.channel_invite_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.channel_invite_links
  WHERE code = invite_code;
END;
$$;

-- Grant execute permission to public (anon) and authenticated users
GRANT EXECUTE ON FUNCTION public.get_invite_by_code(TEXT) TO anon, authenticated, service_role;

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

  -- Update subscriber count for conversations (triggers usually handle this but we do it here explicitly just in case or if logic relies on it)
  UPDATE conversations
  SET subscriber_count = COALESCE(subscriber_count, 0) + 1
  WHERE id = v_link.conversation_id AND type = 'channel';

  RETURN jsonb_build_object('success', true, 'conversation_id', v_link.conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_channel_with_invite_code(TEXT) TO authenticated;
