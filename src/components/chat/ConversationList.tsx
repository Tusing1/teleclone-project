import { useState, useRef, useCallback } from 'react';
import { Search, Edit, Menu, MoreVertical, Users, Radio, Trash2, RefreshCw, Bot, Heart, MessageCircle, X } from 'lucide-react';
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
  onDeleteConversation?: (conversationId: string) => void;
  getUserRole?: (conversationId: string) => string | null;
  onRefresh?: () => Promise<void>;
  onOpenAskAI?: () => void;
  onOpenFindFriends?: () => void;
  onOpenMessageFriends?: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
  onMenuClick,
  onDeleteConversation,
  getUserRole,
  onRefresh,
  onOpenAskAI,
  onOpenFindFriends,
  onOpenMessageFriends
}: ConversationListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  // Pull to refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    const adjustedDistance = Math.min(distance * 0.5, threshold * 1.5);
    setPullDistance(adjustedDistance);
  }, [isPulling, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);

  const filteredConversations = conversations.filter(conv => {
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

  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onDeleteConversation?.(conversationId);
  };

  const isAdmin = (conversationId: string) => {
    const role = getUserRole?.(conversationId);
    return role === 'admin' || role === 'owner';
  };

  const renderConversationItem = (conv: ConversationWithDetails) => {
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
          {conv.avatar_url ? (
            <img
              src={conv.avatar_url}
              alt={conv.name || 'Group'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
          )}
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
                    {isAdmin(conv.id) && (
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Group
                      </DropdownMenuItem>
                    )}
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
          {conv.avatar_url ? (
            <img
              src={conv.avatar_url}
              alt={conv.name || 'Channel'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center">
              <Radio className="w-6 h-6 text-white" />
            </div>
          )}
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
                    {isAdmin(conv.id) && (
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Channel
                      </DropdownMenuItem>
                    )}
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
                  <DropdownMenuItem
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Chat
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

      {/* Conversation list with pull-to-refresh */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        {(pullDistance > 10 || isRefreshing) && (
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
            style={{
              top: Math.min(pullDistance - 40, threshold - 20),
              opacity: progress
            }}
          >
            <div className={cn(
              "w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center",
              isRefreshing && "animate-spin"
            )}>
              <RefreshCw
                className="h-5 w-5 text-primary"
                style={{
                  transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`
                }}
              />
            </div>
          </div>
        )}

        {/* Content with pull offset */}
        <div style={{ transform: `translateY(${pullDistance}px)` }}>
          {filteredConversations.length === 0 ? (
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
      </div>

      {/* Expandable FAB */}
      <div className="absolute bottom-6 right-6 z-50">
        {/* Backdrop when FAB is open */}
        {fabOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10 animate-in fade-in duration-200"
            onClick={() => setFabOpen(false)}
          />
        )}

        {/* FAB Options */}
        <div className="absolute bottom-16 right-0 flex flex-col items-end gap-3">
          {/* Ask AI Option */}
          <div className={cn(
            "flex items-center gap-3 transition-all duration-300",
            fabOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          )} style={{ transitionDelay: fabOpen ? '100ms' : '0ms' }}>
            <span className="text-sm font-medium text-foreground bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              Ask AI
            </span>
            <button
              onClick={() => { onOpenAskAI?.(); setFabOpen(false); }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <Bot className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Find Friends Option */}
          <div className={cn(
            "flex items-center gap-3 transition-all duration-300",
            fabOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          )} style={{ transitionDelay: fabOpen ? '50ms' : '0ms' }}>
            <span className="text-sm font-medium text-foreground bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              Find Friends
            </span>
            <button
              onClick={() => { onOpenFindFriends?.(); setFabOpen(false); }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <Heart className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Message Friends Option */}
          <div className={cn(
            "flex items-center gap-3 transition-all duration-300",
            fabOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          )} style={{ transitionDelay: fabOpen ? '0ms' : '0ms' }}>
            <span className="text-sm font-medium text-foreground bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              Message
            </span>
            <button
              onClick={() => { onOpenMessageFriends?.(); setFabOpen(false); }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <MessageCircle className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300",
            fabOpen
              ? "bg-muted rotate-45"
              : "bg-gradient-to-br from-primary to-primary/80 hover:shadow-primary/25 hover:shadow-2xl"
          )}
        >
          {fabOpen ? (
            <X className="h-6 w-6 text-foreground" />
          ) : (
            <Edit className="h-6 w-6 text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
