-- Linked discussions are storage for post comments, never independent group chats.
-- Existing orphan messages are retained; this guard applies to new/retargeted writes.
CREATE OR REPLACE FUNCTION public.enforce_channel_comment_context()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conversations c WHERE c.type = 'channel' AND c.linked_discussion_id = NEW.conversation_id) THEN
    IF NEW.reply_to_channel_message_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.messages post JOIN public.conversations channel ON channel.id = post.conversation_id
      WHERE post.id = NEW.reply_to_channel_message_id
        AND channel.type = 'channel' AND channel.linked_discussion_id = NEW.conversation_id
    ) THEN
      RAISE EXCEPTION 'Comments must reference a post from the linked channel' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_channel_comment_context
BEFORE INSERT OR UPDATE OF conversation_id, reply_to_channel_message_id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_comment_context();
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON public.messages (conversation_id, reply_to_channel_message_id, created_at)
WHERE reply_to_channel_message_id IS NOT NULL;
