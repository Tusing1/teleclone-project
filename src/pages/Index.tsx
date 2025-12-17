import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useCallNotifications } from '@/hooks/useCallNotifications';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EmptyState } from '@/components/chat/EmptyState';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Sidebar } from '@/components/chat/Sidebar';
import { ArchivedChatsDialog } from '@/components/chat/ArchivedChatsDialog';
import { ContactsDialog } from '@/components/chat/ContactsDialog';
import { InviteFriendsDialog } from '@/components/chat/InviteFriendsDialog';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { CreateChannelDialog } from '@/components/chat/CreateChannelDialog';
import { RecordingsList } from '@/components/chat/RecordingsList';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Enable call notifications
  useCallNotifications();
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
    savedMessagesId,
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
  const [showRecordings, setShowRecordings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const handleNavigateToDiscussion = (discussionId: string) => {
    setSelectedConversationId(discussionId);
  };

  const selectedConversation = [...conversations, ...archivedConversations].find(
    c => c.id === selectedConversationId
  );

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
        onOpenRecordings={savedMessagesId ? () => setShowRecordings(true) : undefined}
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
          <ChatView 
            conversation={selectedConversation}
            onBack={() => setSelectedConversationId(null)}
            onForwardMessage={handleForwardMessage}
            onNavigateToDiscussion={handleNavigateToDiscussion}
            onRefreshConversations={refetchConversations}
          />
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

      {savedMessagesId && (
        <RecordingsList
          open={showRecordings}
          onClose={() => setShowRecordings(false)}
          savedMessagesId={savedMessagesId}
        />
      )}
    </div>
  );
}