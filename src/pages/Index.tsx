import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EmptyState } from '@/components/chat/EmptyState';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Sidebar } from '@/components/chat/Sidebar';
import { cn } from '@/lib/utils';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { conversations, loading: convLoading, createConversation } = useConversations();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
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

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

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
      <Sidebar open={showSidebar} onClose={() => setShowSidebar(false)} />

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
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* New chat dialog */}
      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleSelectUser}
      />
    </div>
  );
}