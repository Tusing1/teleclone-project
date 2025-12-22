-- Create invite links table
CREATE TABLE public.channel_invite_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  max_uses INTEGER DEFAULT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invite link usage tracking
CREATE TABLE public.invite_link_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_link_id UUID NOT NULL REFERENCES public.channel_invite_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create banned users table
CREATE TABLE public.channel_banned_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  banned_by UUID NOT NULL,
  reason TEXT,
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create scheduled calls table
CREATE TABLE public.scheduled_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'video',
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channel_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_link_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

-- RLS for invite links (admins/owners can manage)
CREATE POLICY "Members can view invite links" ON public.channel_invite_links
  FOR SELECT USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Admins can create invite links" ON public.channel_invite_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = channel_invite_links.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update invite links" ON public.channel_invite_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = channel_invite_links.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete invite links" ON public.channel_invite_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = channel_invite_links.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

-- RLS for invite link uses
CREATE POLICY "Members can view invite link uses" ON public.invite_link_uses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_invite_links il
      WHERE il.id = invite_link_uses.invite_link_id
      AND is_conversation_member(auth.uid(), il.conversation_id)
    )
  );

CREATE POLICY "Users can record their own link use" ON public.invite_link_uses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS for banned users
CREATE POLICY "Members can view banned users" ON public.channel_banned_users
  FOR SELECT USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Admins can ban users" ON public.channel_banned_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = channel_banned_users.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can unban users" ON public.channel_banned_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = channel_banned_users.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

-- RLS for scheduled calls
CREATE POLICY "Members can view scheduled calls" ON public.scheduled_calls
  FOR SELECT USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Admins can create scheduled calls" ON public.scheduled_calls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = scheduled_calls.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update scheduled calls" ON public.scheduled_calls
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = scheduled_calls.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete scheduled calls" ON public.scheduled_calls
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = scheduled_calls.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.role IN ('admin', 'owner')
    )
  );