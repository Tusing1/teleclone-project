import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useFindFriends } from '@/hooks/useFindFriends';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useReferrals } from '@/hooks/useReferrals';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { DiscussionView } from '@/components/chat/DiscussionView';
import { EmptyState } from '@/components/chat/EmptyState';
const NewChatDialog = lazy(() => import('@/components/chat/NewChatDialog').then(module => ({ default: module.NewChatDialog })));
import { Sidebar } from '@/components/chat/Sidebar';
const ContactsDialog = lazy(() => import('@/components/chat/ContactsDialog').then(module => ({ default: module.ContactsDialog })));
const InviteFriendsDialog = lazy(() => import('@/components/chat/InviteFriendsDialog').then(module => ({ default: module.InviteFriendsDialog })));
const CreateGroupDialog = lazy(() => import('@/components/chat/CreateGroupDialog').then(module => ({ default: module.CreateGroupDialog })));
const CreateChannelDialog = lazy(() => import('@/components/chat/CreateChannelDialog').then(module => ({ default: module.CreateChannelDialog })));
const ForwardMessageDialog = lazy(() => import('@/components/chat/ForwardMessageDialog').then(module => ({ default: module.ForwardMessageDialog })));
const FindFriendsDialog = lazy(() => import('@/components/chat/FindFriendsDialog').then(module => ({ default: module.FindFriendsDialog })));
const EditProfileDialog = lazy(() => import('@/components/chat/EditProfileDialog').then(module => ({ default: module.EditProfileDialog })));
const CallsInboxDialog = lazy(() => import('@/components/chat/CallsInboxDialog').then(module => ({ default: module.CallsInboxDialog })));
const InviteJoinDialog = lazy(() => import('@/components/chat/InviteJoinDialog').then(module => ({ default: module.InviteJoinDialog })));
const GlobalSearchDialog = lazy(() => import('@/components/chat/GlobalSearchDialog').then(module => ({ default: module.GlobalSearchDialog })));
const FriendRequestsDialog = lazy(() => import('@/components/chat/FriendRequestsDialog').then(module => ({ default: module.FriendRequestsDialog })));
const MessageFriendsDialog = lazy(() => import('@/components/chat/MessageFriendsDialog').then(module => ({ default: module.MessageFriendsDialog })));
const StudyBuddiesDialog = lazy(() => import('@/components/chat/StudyBuddiesDialog').then(module => ({ default: module.StudyBuddiesDialog })));
const SettingsDialog = lazy(() => import('@/components/chat/SettingsDialog').then(module => ({ default: module.SettingsDialog })));
const InAppBrowser = lazy(() => import('@/components/chat/InAppBrowser').then(module => ({ default: module.InAppBrowser })));
import { InterestsOnboarding } from '@/components/chat/InterestsOnboarding';
const DownloadedFilesDialog = lazy(() => import('@/components/chat/DownloadedFilesDialog').then(module => ({ default: module.DownloadedFilesDialog })));
const RecordingsView = lazy(() => import('@/components/chat/RecordingsView').then(module => ({ default: module.RecordingsView })));
import { EncryptionInitializer } from '@/components/chat/EncryptionInitializer';
import { PWAUpdatePrompt } from '@/components/chat/PWAUpdatePrompt';
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

  // Referrals hook for processing pending referral codes
  const { processReferralCode } = useReferrals();


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
    forwardToConversation,
    fetchConversations: refetchConversations
  } = useConversations();

  const { pendingCount: friendRequestsCount } = useFriendRequests();
  const { likedByCount } = useFindFriends(false);
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
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showMessageFriends, setShowMessageFriends] = useState(false);
  const [showStudyBuddies, setShowStudyBuddies] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloaded, setShowDownloaded] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [forwardDialogMessage, setForwardDialogMessage] = useState<MessageWithSender | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [showInterestsOnboarding, setShowInterestsOnboarding] = useState(false);
  const { profile } = useAuth();

  // Discussion group navigation state
  const [discussionContext, setDiscussionContext] = useState<{
    discussionId: string;
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

  useEffect(() => {
    const open = (data: { conversationId?: string; type?: string }) => {
      if (data?.conversationId && /^[0-9a-f-]{36}$/i.test(data.conversationId)) {
        setSelectedConversationId(data.conversationId);
        setDiscussionContext(null); setShowRecordings(false);
      } else if (data?.type === 'match') setShowFindFriends(true);
    };
    open({ conversationId: new URLSearchParams(location.search).get('conversation') || undefined });
    const listener = (event: MessageEvent) => { if (event.data?.type === 'NOTIFICATION_CLICK') open(event.data.payload); };
    navigator.serviceWorker?.addEventListener('message', listener);
    return () => navigator.serviceWorker?.removeEventListener('message', listener);
  }, [location.search]);

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

    return () => {
      // Clean up any remaining global subscriptions if needed
    };
  }, [user]);

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

  // Forwarding opens the destination picker, like Telegram.
  const handleForwardMessage = (message: MessageWithSender) => {
    setForwardDialogMessage(message);
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

  const handleNavigateToDiscussion = async (discussionId: string, parentChannel?: ConversationWithDetails, replyToMessage?: MessageWithSender) => {
    setDiscussionContext({ discussionId, parentChannel: parentChannel || null, replyToMessage: replyToMessage || null });
    setSelectedConversationId(discussionId);
    // Keep navigation synchronous; membership refresh runs behind the comments screen.
    void refetchConversations();
  };

  const handleInviteJoined = (conversationId: string) => {
    refetchConversations();
    setSelectedConversationId(conversationId);
    setPendingInviteCode(null);
  };

  const selectedConversation = [...conversations, ...archivedConversations].find(
    c => c.id === selectedConversationId
  ) || (discussionContext?.parentChannel && discussionContext.discussionId === selectedConversationId ? {
    ...discussionContext.parentChannel, id: discussionContext.discussionId, type: 'group' as const, participants: [],
  } : undefined);

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

  const showChatList = !isMobile || (!selectedConversationId && !showRecordings);
  const showChat = !isMobile || selectedConversationId || showRecordings;

  return (
    <div className="flex h-full h-[100dvh] overflow-hidden bg-background relative safe-top safe-bottom">
      {/* E2EE Encryption Initializer */}
      <EncryptionInitializer />
      {/* PWA Update Prompt */}
      <PWAUpdatePrompt />
      {/* Main app shell */}
      <div className="flex w-full h-full relative z-10 ">
        {showDownloaded && <Suspense fallback={null}><DownloadedFilesDialog onClose={() => setShowDownloaded(false)} /></Suspense>}
        {/* Sidebar menu */}
        <Sidebar
          open={showSidebar}
          onClose={() => setShowSidebar(false)}
          onOpenContacts={() => setShowContacts(true)}
          onOpenCreateGroup={() => setShowCreateGroup(true)}
          onOpenCreateChannel={() => setShowCreateChannel(true)}
          onOpenInviteFriends={() => setShowInviteFriends(true)}
          onOpenCallsInbox={() => setShowCallsInbox(true)}
          onOpenFriendRequests={() => setShowFriendRequests(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenDownloaded={() => setShowDownloaded(true)}
          onOpenRecordings={() => {
            setSelectedConversationId(null);
            setShowRecordings(true);
          }}
        />

        {/* Conversation list */}
        <div
          className={cn(
            'relative w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 transition-all',
            !showChatList && 'hidden md:block'
          )}
        >
          <ConversationList
            conversations={conversations.filter(c => !conversations.some(parent => parent.type === 'channel' && parent.linked_discussion_id === c.id))}
            selectedId={selectedConversationId}
            onSelect={(id) => {
              setDiscussionContext(null);
              setSelectedConversationId(id);
              setShowRecordings(false);
            }}
            onNewChat={() => setShowNewChat(true)}
            onMenuClick={() => setShowSidebar(true)}
            onDeleteConversation={handleDeleteConversation}
            getUserRole={getUserRole}
            onRefresh={refetchConversations}
            onOpenFindFriends={() => setShowFindFriends(true)}
            onOpenSavedMessages={handleOpenSavedMessages}
            onOpenMessageFriends={() => setShowMessageFriends(true)}
            onOpenEditProfile={() => setShowEditProfile(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenGlobalSearch={() => setShowGlobalSearch(true)}
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
                key={discussionContext?.replyToMessage?.id || selectedConversation.id}
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
                key={selectedConversation.id}
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
          ) : showRecordings ? (
            <Suspense fallback={<div role="status" className="p-6 text-muted-foreground">Opening recordings…</div>}><RecordingsView onBack={() => setShowRecordings(false)} /></Suspense>
          ) : (
            <EmptyState />
          )}
        </div>

        <Suspense fallback={<div role="status" className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center"><span className="text-primary animate-pulse">Opening…</span></div>}>
        {/* Dialogs */}
        {showNewChat && (<NewChatDialog
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onSelectUser={handleSelectUser}
        />)}


        {showContacts && (<ContactsDialog
          open={showContacts}
          onClose={() => setShowContacts(false)}
          onSelectUser={handleSelectUser}
          onOpenInvite={() => setShowInviteFriends(true)}
        />)}

        {showInviteFriends && (<InviteFriendsDialog
          open={showInviteFriends}
          onClose={() => setShowInviteFriends(false)}
        />)}

        {showCreateGroup && (<CreateGroupDialog
          open={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onCreateGroup={handleCreateGroup}
        />)}

        {showCreateChannel && (<CreateChannelDialog
          open={showCreateChannel}
          onClose={() => setShowCreateChannel(false)}
          onCreateChannel={handleCreateChannel}
        />)}

        {forwardDialogMessage && (<ForwardMessageDialog
          open={!!forwardDialogMessage}
          onClose={() => setForwardDialogMessage(null)}
          message={forwardDialogMessage}
          conversations={conversations}
          onForward={handleForwardToConversation}
        />)}

        {showFindFriends && (<FindFriendsDialog
          open={showFindFriends}
          onEditProfile={() => setShowEditProfile(true)}
          onClose={() => setShowFindFriends(false)}
          onOpenConversation={(conversationId) => {
            refetchConversations();
            setSelectedConversationId(conversationId);
          }}
        />)}

        {showEditProfile && (<EditProfileDialog
          open={showEditProfile}
          onClose={() => setShowEditProfile(false)}
        />)}


        {showCallsInbox && (<CallsInboxDialog
          open={showCallsInbox}
          onClose={() => setShowCallsInbox(false)}
          onOpenConversation={(conversationId) => {
            setSelectedConversationId(conversationId);
          }}
        />)}

        {/* Invite join dialog */}
        {pendingInviteCode && (<InviteJoinDialog
          open={!!pendingInviteCode}
          onClose={() => setPendingInviteCode(null)}
          inviteCode={pendingInviteCode || ''}
          onJoined={handleInviteJoined}
        />)}


        {showGlobalSearch && (<GlobalSearchDialog
          open={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onSelectUser={handleSelectUser}
        />)}



        {showFriendRequests && (<FriendRequestsDialog
          open={showFriendRequests}
          onClose={() => setShowFriendRequests(false)}
          onOpenConversation={(conversationId) => {
            refetchConversations();
            setSelectedConversationId(conversationId);
            setShowFriendRequests(false);
          }}
        />)}

        {showMessageFriends && (<MessageFriendsDialog
          open={showMessageFriends}
          onClose={() => setShowMessageFriends(false)}
          onSelectConversation={(conversationId) => {
            setSelectedConversationId(conversationId);
          }}
        />)}

        {showStudyBuddies && (<StudyBuddiesDialog
          open={showStudyBuddies}
          onClose={() => setShowStudyBuddies(false)}
          onSelectUser={handleSelectUser}
        />)}


        {showSettings && (<SettingsDialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onEditProfile={() => { setShowSettings(false); setShowEditProfile(true); }}
          onOpenDownloads={() => { setShowSettings(false); setShowDownloaded(true); }}
        />)}

        {browserUrl && (<InAppBrowser
          open={!!browserUrl}
          url={browserUrl || ''}
          onClose={() => setBrowserUrl(null)}
        />)}
        </Suspense>
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
