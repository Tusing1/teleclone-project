import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { DiscussionView } from '@/components/chat/DiscussionView';
import { EmptyState } from '@/components/chat/EmptyState';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Sidebar } from '@/components/chat/Sidebar';
import { ArchivedChatsDialog } from '@/components/chat/ArchivedChatsDialog';
import { ContactsDialog } from '@/components/chat/ContactsDialog';
import { InviteFriendsDialog } from '@/components/chat/InviteFriendsDialog';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { CreateChannelDialog } from '@/components/chat/CreateChannelDialog';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { 
    conversations, 
    archivedConversations,
    loading: convLoading, 
    createConversation,
    createGroup,
    createChannel,
    archiveConversation,
    unarchiveConversation,
    getOrCreateSavedMessages,
    forwardToSavedMessages,
    refetch: refetchConversations
  } = useConversations();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Discussion group navigation state
  const [discussionContext, setDiscussionContext] = useState<{
    parentChannel: ConversationWithDetails | null;
    replyToMessage: MessageWithSender | null;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectUser = async (userId: string) => {
    const conversationId = await createConversation(userId);
    if (conversationId) {
      setSelectedConversationId(conversationId);
    }
  };

  const handleOpenSavedMessages = async () => {
    const savedId = await getOrCreateSavedMessages();
    if (savedId) {
      await refetchConversations();
      setSelectedConversationId(savedId);
    }
  };

  const handleForwardMessage = async (message: any) => {
    const success = await forwardToSavedMessages(message);
    if (success) {
      toast.success('Message forwarded to Saved Messages');
    } else {
      toast.error('Failed to forward message');
    }
  };

  const handleCreateGroup = async (name: string, description: string, memberIds: string[]) => {
    const conversationId = await createGroup(name, description, memberIds);
    if (conversationId) {
      setSelectedConversationId(conversationId);
      toast.success('Group created');
    } else {
      toast.error('Failed to create group');
    }
    return conversationId;
  };

  const handleCreateChannel = async (name: string, description: string, enableDiscussion: boolean) => {
    const conversationId = await createChannel(name, description, enableDiscussion);
    if (conversationId) {
      setSelectedConversationId(conversationId);
      toast.success('Channel created');
    } else {
      toast.error('Failed to create channel');
    }
    return conversationId;
  };

  const handleArchiveConversation = async (conversationId: string) => {
    const success = await archiveConversation(conversationId);
    if (success) {
      toast.success('Chat archived');
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
    } else {
      toast.error('Failed to archive chat');
    }
  };

  const handleUnarchiveConversation = async (conversationId: string) => {
    const success = await unarchiveConversation(conversationId);
    if (success) {
      toast.success('Chat unarchived');
    }
    return success;
  };

  const handleNavigateToDiscussion = (discussionId: string, parentChannel?: ConversationWithDetails, replyToMessage?: MessageWithSender) => {
    setSelectedConversationId(discussionId);
    if (parentChannel) {
      setDiscussionContext({ parentChannel, replyToMessage: replyToMessage || null });
    }
  };

  const selectedConversation = [...conversations, ...archivedConversations].find(
    c => c.id === selectedConversationId
  );
  
  // Check if current conversation is a discussion group (has a parent channel linking to it)
  const isDiscussionGroup = selectedConversation && conversations.some(
    c => c.type === 'channel' && c.linked_discussion_id === selectedConversation.id
  );
  
  // Get parent channel if in discussion
  const parentChannel = isDiscussionGroup ? conversations.find(
    c => c.type === 'channel' && c.linked_discussion_id === selectedConversation?.id
  ) : discussionContext?.parentChannel;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const showChatList = !isMobile || !selectedConversationId;
  const showChat = !isMobile || selectedConversationId;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar menu */}
      <Sidebar 
        open={showSidebar} 
        onClose={() => setShowSidebar(false)}
        onOpenSavedMessages={handleOpenSavedMessages}
        onOpenArchived={() => setShowArchived(true)}
        onOpenContacts={() => setShowContacts(true)}
        onOpenCreateGroup={() => setShowCreateGroup(true)}
        onOpenCreateChannel={() => setShowCreateChannel(true)}
        onOpenInviteFriends={() => setShowInviteFriends(true)}
      />

      {/* Conversation list */}
      <div 
        className={cn(
          'relative w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 transition-all',
          !showChatList && 'hidden md:block'
        )}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onNewChat={() => setShowNewChat(true)}
          onMenuClick={() => setShowSidebar(true)}
          onOpenSavedMessages={handleOpenSavedMessages}
          onArchiveConversation={handleArchiveConversation}
        />
      </div>

      {/* Chat view */}
      <div 
        className={cn(
          'flex-1 min-w-0',
          !showChat && 'hidden md:block'
        )}
      >
        {selectedConversation ? (
          isDiscussionGroup ? (
            <DiscussionView
              conversation={selectedConversation}
              parentChannel={parentChannel}
              replyToMessage={discussionContext?.replyToMessage}
              onBack={() => {
                // Go back to parent channel if available
                if (parentChannel) {
                  setSelectedConversationId(parentChannel.id);
                } else {
                  setSelectedConversationId(null);
                }
                setDiscussionContext(null);
              }}
              onRefreshConversations={refetchConversations}
            />
          ) : (
            <ChatView 
              conversation={selectedConversation}
              onBack={() => setSelectedConversationId(null)}
              onForwardMessage={handleForwardMessage}
              onNavigateToDiscussion={(discussionId, msg) => {
                handleNavigateToDiscussion(discussionId, selectedConversation, msg);
              }}
              onRefreshConversations={refetchConversations}
            />
          )
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Dialogs */}
      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleSelectUser}
      />
      
      <ArchivedChatsDialog
        open={showArchived}
        onClose={() => setShowArchived(false)}
        archivedConversations={archivedConversations}
        onUnarchive={handleUnarchiveConversation}
        onSelectConversation={setSelectedConversationId}
      />
      
      <ContactsDialog
        open={showContacts}
        onClose={() => setShowContacts(false)}
        onSelectUser={handleSelectUser}
      />
      
      <InviteFriendsDialog
        open={showInviteFriends}
        onClose={() => setShowInviteFriends(false)}
      />
      
      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreateGroup={handleCreateGroup}
      />
      
      <CreateChannelDialog
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  );
}