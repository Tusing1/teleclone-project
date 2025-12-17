import { useState } from 'react';
import { Search, Edit, Menu, Bookmark, Archive, MoreVertical, Users, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { ConversationWithDetails } from '@/types/chat';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onMenuClick: () => void;
  onOpenSavedMessages: () => void;
  onArchiveConversation?: (conversationId: string) => void;
}

export function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect, 
  onNewChat,
  onMenuClick,
  onOpenSavedMessages,
  onArchiveConversation
}: ConversationListProps) {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');

  const filteredConversations = conversations.filter(conv => {
    // Always show Saved Messages if search matches
    if (conv.isSavedMessages) {
      return 'saved messages'.includes(search.toLowerCase());
    }
    
    // Groups and channels use their name
    if (conv.type === 'group' || conv.type === 'channel') {
      return conv.name?.toLowerCase().includes(search.toLowerCase()) ?? false;
    }
    
    // Direct messages use other participant's name
    const otherParticipant = conv.participants.find(p => p.user_id !== user?.id);
    if (!otherParticipant?.profile) return false;
    
    const name = otherParticipant.profile.full_name || otherParticipant.profile.username;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleArchive = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onArchiveConversation?.(conversationId);
  };

  const renderConversationItem = (conv: ConversationWithDetails) => {
    // Saved Messages special rendering
    if (conv.isSavedMessages) {
      const lastMessageTime = conv.lastMessage?.created_at || conv.updated_at;
      const lastMessageText = conv.lastMessage?.content || 'No messages yet';

      return (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-secondary/50',
            selectedId === conv.id && 'bg-primary/10'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Bookmark className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">Saved Messages</span>
              {conv.lastMessage && (
                <span className="text-xs text-muted-foreground">
                  {formatTime(lastMessageTime)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {conv.lastMessage?.message_type === 'image' ? '📷 Photo' :
               conv.lastMessage?.message_type === 'file' ? '📎 File' :
               lastMessageText}
            </p>
          </div>
        </div>
      );
    }

    // Group conversation rendering
    if (conv.type === 'group') {
      const lastMessageTime = conv.lastMessage?.created_at || conv.updated_at;
      const lastMessageText = conv.lastMessage?.content || 'No messages yet';
      const memberCount = conv.participants.length;

      return (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-secondary/50 group',
            selectedId === conv.id && 'bg-primary/10'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{conv.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(lastMessageTime)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleArchive(e, conv.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {memberCount} members • {conv.lastMessage?.message_type === 'image' ? '📷 Photo' :
               conv.lastMessage?.message_type === 'file' ? '📎 File' :
               lastMessageText}
            </p>
          </div>
        </div>
      );
    }

    // Channel conversation rendering
    if (conv.type === 'channel') {
      const lastMessageTime = conv.lastMessage?.created_at || conv.updated_at;
      const lastMessageText = conv.lastMessage?.content || 'No messages yet';
      const subscriberCount = conv.participants.length;

      return (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-secondary/50 group',
            selectedId === conv.id && 'bg-primary/10'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{conv.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(lastMessageTime)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleArchive(e, conv.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {subscriberCount} subscribers • {conv.lastMessage?.message_type === 'image' ? '📷 Photo' :
               conv.lastMessage?.message_type === 'file' ? '📎 File' :
               lastMessageText}
            </p>
          </div>
        </div>
      );
    }

    // Regular direct conversation rendering
    const otherParticipant = conv.participants.find(p => p.user_id !== user?.id);
    if (!otherParticipant?.profile) return null;

    const { profile: otherProfile } = otherParticipant;
    const displayName = otherProfile.full_name || otherProfile.username;
    const lastMessageTime = conv.lastMessage?.created_at || conv.updated_at;
    const lastMessageText = conv.lastMessage?.content || 'No messages yet';

    return (
      <div
        key={conv.id}
        onClick={() => onSelect(conv.id)}
        className={cn(
          'flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-secondary/50 group',
          selectedId === conv.id && 'bg-primary/10'
        )}
      >
        <Avatar
          src={otherProfile.avatar_url}
          name={displayName}
          isOnline={otherProfile.is_online}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{displayName}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {formatTime(lastMessageTime)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleArchive(e, conv.id)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {conv.lastMessage?.sender_id === user?.id && (
              <span className="text-primary">You: </span>
            )}
            {conv.lastMessage?.message_type === 'image' ? '📷 Photo' :
             conv.lastMessage?.message_type === 'file' ? '📎 File' :
             lastMessageText}
          </p>
        </div>
      </div>
    );
  };

  // Check if Saved Messages exists in conversations
  const hasSavedMessages = conversations.some(c => c.isSavedMessages);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onMenuClick}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-0"
            />
          </div>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Saved Messages shortcut if it doesn't exist yet */}
        {!hasSavedMessages && !search && (
          <div
            onClick={onOpenSavedMessages}
            className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-secondary/50 border-b border-border/50"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">Saved Messages</span>
              <p className="text-sm text-muted-foreground">Save messages here</p>
            </div>
          </div>
        )}

        {filteredConversations.length === 0 && hasSavedMessages ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No conversations yet</p>
            <Button 
              variant="link" 
              onClick={onNewChat}
              className="text-primary"
            >
              Start a new chat
            </Button>
          </div>
        ) : (
          filteredConversations.map(renderConversationItem)
        )}
      </div>

      {/* New chat FAB */}
      <Button
        onClick={onNewChat}
        size="icon"
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full shadow-lg"
      >
        <Edit className="h-6 w-6" />
      </Button>
    </div>
  );
}