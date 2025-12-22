-- Create table for restricted members in discussion groups
CREATE TABLE public.discussion_restricted_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    restricted_by UUID NOT NULL,
    reason TEXT,
    restricted_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.discussion_restricted_members ENABLE ROW LEVEL SECURITY;

-- Admins can add restrictions
CREATE POLICY "Admins can add restrictions"
ON public.discussion_restricted_members
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = discussion_restricted_members.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('admin', 'owner')
    )
);

-- Admins can remove restrictions
CREATE POLICY "Admins can remove restrictions"
ON public.discussion_restricted_members
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = discussion_restricted_members.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('admin', 'owner')
    )
);

-- Admins can update restrictions
CREATE POLICY "Admins can update restrictions"
ON public.discussion_restricted_members
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = discussion_restricted_members.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('admin', 'owner')
    )
);

-- Members can view their own restriction status
CREATE POLICY "Members can view restrictions"
ON public.discussion_restricted_members
FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = discussion_restricted_members.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('admin', 'owner')
    )
);