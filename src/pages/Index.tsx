import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useFindFriends } from '@/hooks/useFindFriends';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useReferrals } from '@/hooks/useReferrals';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { DiscussionView } from '@/components/chat/DiscussionView';
import { EmptyState } from '@/components/chat/EmptyState';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Sidebar } from '@/components/chat/Sidebar';
import { ContactsDialog } from '@/components/chat/ContactsDialog';
import { InviteFriendsDialog } from '@/components/chat/InviteFriendsDialog';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { CreateChannelDialog } from '@/components/chat/CreateChannelDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { FindFriendsDialog } from '@/components/chat/FindFriendsDialog';
import { EditProfileDialog } from '@/components/chat/EditProfileDialog';
import { CallsInboxDialog } from '@/components/chat/CallsInboxDialog';
import { InviteJoinDialog } from '@/components/chat/InviteJoinDialog';
import { StudyTokensDialog } from '@/components/chat/StudyTokensDialog';
import { GlobalSearchDialog } from '@/components/chat/GlobalSearchDialog';
import { AdminPanelDialog } from '@/components/chat/AdminPanelDialog';
import { AskAIDialog } from '@/components/chat/AskAIDialog';
import { FriendRequestsDialog } from '@/components/chat/FriendRequestsDialog';
import { MessageFriendsDialog } from '@/components/chat/MessageFriendsDialog';
import { StudyBuddiesDialog } from '@/components/chat/StudyBuddiesDialog';
import { StudyLabsDialog } from '@/components/chat/StudyLabsDialog';
import { SettingsDialog } from '@/components/chat/SettingsDialog';
import { InAppBrowser } from '@/components/chat/InAppBrowser';
import { InterestsOnboarding } from '@/components/chat/InterestsOnboarding';
import { ConversationWithDetails, MessageWithSender } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Radio, Bell } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize notification sound listener
  useNotificationSound();

  // Study tokens hook for daily login tracking
  const { checkDailyLogin } = useStudyTokens();

  // Referrals hook for processing pending referral codes
  const { processReferralCode } = useReferrals();

  // Check daily login on app load
  useEffect(() => {
    if (user) {
      checkDailyLogin().then((result) => {
        if (result) {
          if (result.milestoneBonus && result.milestoneMessage) {
            toast.success(`${result.milestoneMessage} +${result.tokensEarned} tokens!`);
          } else {
            toast.success(`🔥 Day ${result.streak} streak! +${result.tokensEarned} tokens`);
          }
        }
      });
    }
  }, [user, checkDailyLogin]);

  const {
    conversations,
    archivedConversations,
    loading: convLoading,
    createConversation,
    createGroup,
    createChannel,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    getUserRole,
    getOrCreateSavedMessages,
    forwardToSavedMessages,
    forwardToConversation,
    fetchConversations: refetchConversations
  } = useConversations();

  const { pendingCount: friendRequestsCount } = useFriendRequests();
  const { likedByCount } = useFindFriends();
  const totalLikesCount = friendRequestsCount + likedByCount;

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showFindFriends, setShowFindFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCallsInbox, setShowCallsInbox] = useState(false);
  const [showStudyTokens, setShowStudyTokens] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAskAI, setShowAskAI] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showMessageFriends, setShowMessageFriends] = useState(false);
  const [showStudyBuddies, setShowStudyBuddies] = useState(false);
  const [showStudyLabs, setShowStudyLabs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [forwardDialogMessage, setForwardDialogMessage] = useState<MessageWithSender | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [showInterestsOnboarding, setShowInterestsOnboarding] = useState(false);
  const { profile } = useAuth();

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

  // Handle invite code from navigation state
  useEffect(() => {
    const state = location.state as { inviteCode?: string; conversationId?: string } | null;
    if (state?.inviteCode) {
      setPendingInviteCode(state.inviteCode);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
    if (state?.conversationId) {
      setSelectedConversationId(state.conversationId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Process pending referral code after signup
  useEffect(() => {
    const pendingRef = sessionStorage.getItem('pendingReferralCode');
    if (pendingRef && user) {
      sessionStorage.removeItem('pendingReferralCode');
      processReferralCode(pendingRef).then((success) => {
        if (success) {
          toast.success('Welcome! You joined via a referral link.');
        }
      });
    }
  }, [user, processReferralCode]);

  // Handle mandatory interests onboarding
  useEffect(() => {
    if (!authLoading && user && profile) {
      if (!profile.interests || profile.interests.length < 3) {
        setShowInterestsOnboarding(true);
      }
    }
  }, [authLoading, user, profile]);

  // Global call and livestream notifications
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Initializing global call listener for user:', user.id);

    // Listen for new calls
    const callsSubscription = supabase
      .channel('global-calls')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls' },
        async (payload) => {
          const newCall = payload.new;
          if (newCall.started_by === user.id) return;

          // Check if user is participant in this conversation
          const isParticipant = conversations.some(c => c.id === newCall.conversation_id);
          if (isParticipant) {
            const conv = conversations.find(c => c.id === newCall.conversation_id);
            toast(
              `Incoming ${newCall.call_type} call from ${conv?.name || 'someone'}`,
              {
                icon: <Phone className="h-4 w-4 text-green-500" />,
                action: {
                  label: 'Join',
                  onClick: () => setSelectedConversationId(newCall.conversation_id)
                },
                duration: 10000
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'livestreams' },
        async (payload) => {
          const newStream = payload.new;
          if (newStream.requested_by === user.id) return;

          // Check if user is participant in this conversation
          const isParticipant = conversations.some(c => c.id === newStream.conversation_id);
          if (isParticipant) {
            const conv = conversations.find(c => c.id === newStream.conversation_id);
            toast(
              `Live Stream started in ${conv?.name || 'Channel'}`,
              {
                icon: <Radio className="h-4 w-4 text-primary animate-pulse" />,
                description: newStream.livestream_title || 'Join the live broadcast!',
                action: {
                  label: 'View',
                  onClick: () => setSelectedConversationId(newStream.conversation_id)
                },
                duration: 8000
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsSubscription);
    };
  }, [user, conversations]);

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

  // Forward message - if in Saved Messages, show destination picker; else forward to Saved Messages
  const handleForwardMessage = async (message: MessageWithSender, fromSavedMessages: boolean = false) => {
    if (fromSavedMessages) {
      // From Saved Messages - show forward dialog to pick destination
      setForwardDialogMessage(message);
    } else {
      // Forward to Saved Messages
      const success = await forwardToSavedMessages(message);
      if (success) {
        toast.success('Message forwarded to Saved Messages');
      } else {
        toast.error('Failed to forward message');
      }
    }
  };

  const handleForwardToConversation = async (message: MessageWithSender, conversationId: string): Promise<boolean> => {
    const success = await forwardToConversation(message, conversationId);
    if (success) {
      toast.success('Message forwarded');
    } else {
      toast.error('Failed to forward message');
    }
    return success;
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

  const handleDeleteConversation = async (conversationId: string) => {
    const success = await deleteConversation(conversationId);
    if (success) {
      toast.success('Deleted successfully');
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
    } else {
      toast.error('Failed to delete');
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

  const handleInviteJoined = (conversationId: string) => {
    refetchConversations();
    setSelectedConversationId(conversationId);
    setPendingInviteCode(null);
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
    <div className="flex h-full h-[100dvh] overflow-hidden bg-[#0a0a0f] relative safe-top safe-bottom">
      {/* Immersive Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-blue-600/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-pink-600/10 rounded-full blur-[120px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* Main Glassmorphic Shell */}
      <div className="flex w-full h-full relative z-10 backdrop-blur-[2px]">
        {/* Sidebar menu */}
        <Sidebar
          open={showSidebar}
          onClose={() => setShowSidebar(false)}
          onOpenContacts={() => setShowContacts(true)}
          onOpenCreateGroup={() => setShowCreateGroup(true)}
          onOpenCreateChannel={() => setShowCreateChannel(true)}
          onOpenInviteFriends={() => setShowInviteFriends(true)}
          onOpenFindFriends={() => setShowFindFriends(true)}
          onOpenEditProfile={() => setShowEditProfile(true)}
          onOpenCallsInbox={() => setShowCallsInbox(true)}
          onOpenStudyTokens={() => setShowStudyTokens(true)}
          onOpenGlobalSearch={() => setShowGlobalSearch(true)}
          onOpenAdminPanel={() => setShowAdminPanel(true)}
          onOpenAskAI={() => setShowAskAI(true)}
          onOpenFriendRequests={() => setShowFriendRequests(true)}
          onOpenStudyBuddies={() => setShowStudyBuddies(true)}
          onOpenStudyLabs={() => setShowStudyLabs(true)}
          onOpenSettings={() => setShowSettings(true)}
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
            onDeleteConversation={handleDeleteConversation}
            getUserRole={getUserRole}
            onRefresh={refetchConversations}
            onOpenAskAI={() => setShowAskAI(true)}
            onOpenFindFriends={() => setShowFindFriends(true)}
            onOpenMessageFriends={() => setShowMessageFriends(true)}
            pendingLikesCount={totalLikesCount}
            loading={convLoading}
          />
        </div>

        {/* Chat view */}
        <div
          className={cn(
            'flex-1 min-w-0 md:p-0',
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
                onOpenBrowser={(url) => setBrowserUrl(url)}
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
                onOpenBrowser={(url) => setBrowserUrl(url)}
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


        <ContactsDialog
          open={showContacts}
          onClose={() => setShowContacts(false)}
          onSelectUser={handleSelectUser}
          onOpenInvite={() => setShowInviteFriends(true)}
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

        <ForwardMessageDialog
          open={!!forwardDialogMessage}
          onClose={() => setForwardDialogMessage(null)}
          message={forwardDialogMessage}
          conversations={conversations}
          onForward={handleForwardToConversation}
        />

        <FindFriendsDialog
          open={showFindFriends}
          onClose={() => setShowFindFriends(false)}
          onOpenConversation={(conversationId) => {
            refetchConversations();
            setSelectedConversationId(conversationId);
          }}
        />

        <EditProfileDialog
          open={showEditProfile}
          onClose={() => setShowEditProfile(false)}
        />


        <CallsInboxDialog
          open={showCallsInbox}
          onClose={() => setShowCallsInbox(false)}
          onOpenConversation={(conversationId) => {
            setSelectedConversationId(conversationId);
          }}
        />

        {/* Invite join dialog */}
        <InviteJoinDialog
          open={!!pendingInviteCode}
          onClose={() => setPendingInviteCode(null)}
          inviteCode={pendingInviteCode || ''}
          onJoined={handleInviteJoined}
        />

        <StudyTokensDialog
          open={showStudyTokens}
          onClose={() => setShowStudyTokens(false)}
          onOpenBrowser={(url) => setBrowserUrl(url)}
        />

        <GlobalSearchDialog
          open={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onSelectUser={handleSelectUser}
        />

        <AdminPanelDialog
          open={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
        />

        <AskAIDialog
          open={showAskAI}
          onClose={() => setShowAskAI(false)}
        />

        <FriendRequestsDialog
          open={showFriendRequests}
          onClose={() => setShowFriendRequests(false)}
          onOpenConversation={(conversationId) => {
            refetchConversations();
            setSelectedConversationId(conversationId);
            setShowFriendRequests(false);
          }}
        />

        <MessageFriendsDialog
          open={showMessageFriends}
          onClose={() => setShowMessageFriends(false)}
          onSelectConversation={(conversationId) => {
            setSelectedConversationId(conversationId);
          }}
        />

        <StudyBuddiesDialog
          open={showStudyBuddies}
          onClose={() => setShowStudyBuddies(false)}
          onSelectUser={handleSelectUser}
        />

        <StudyLabsDialog
          open={showStudyLabs}
          onClose={() => setShowStudyLabs(false)}
        />

        <SettingsDialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
        />

        <InAppBrowser
          open={!!browserUrl}
          url={browserUrl || ''}
          onClose={() => setBrowserUrl(null)}
        />
        {/* Interests Onboarding - Mandatory */}
        {user && (
          <InterestsOnboarding
            open={showInterestsOnboarding}
            onComplete={() => {
              setShowInterestsOnboarding(false);
              window.location.reload(); // Refresh to get updated profile
            }}
            userId={user.id}
          />
        )}
      </div>
    </div>
  );
}
