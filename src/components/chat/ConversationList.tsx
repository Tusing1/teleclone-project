import { useState, useRef, useCallback } from 'react';
import { Search, Edit, Menu, MoreVertical, Users, Radio, Trash2, RefreshCw, Bot, Heart, MessageCircle, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
  pendingLikesCount?: number;
  loading?: boolean;
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
  onOpenMessageFriends,
  pendingLikesCount = 0,
  loading = false
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

  const renderConversationItem = (conv: ConversationWithDetails, index: number) => {
    const animationDelay = `${index * 50}ms`;
    
    // Group conversation rendering
    if (conv.type === 'group') {
      const lastMessageTime = conv.lastMessage?.created_at || conv.updated_at;
      const lastMessageText = conv.lastMessage?.content || 'No messages yet';
      const memberCount = conv.participants.length;

      return (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          style={{ animationDelay }}
          className={cn(
            'flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 group rounded-xl mx-2 my-1',
            'border border-transparent',
            'hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5',
            'hover:border-white/20 hover:shadow-lg hover:shadow-primary/5',
            'hover:scale-[1.02] active:scale-[0.98]',
            'animate-fade-in opacity-0 [animation-fill-mode:forwards]',
            selectedId === conv.id && 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/10'
          )}
        >
          {conv.avatar_url ? (
            <img
              src={conv.avatar_url}
              alt={conv.name || 'Group'}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-primary/30 transition-all"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-emerald-400/50 transition-all shadow-lg shadow-emerald-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate group-hover:text-white transition-colors">{conv.name}</span>
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
          style={{ animationDelay }}
          className={cn(
            'flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 group rounded-xl mx-2 my-1',
            'border border-transparent',
            'hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5',
            'hover:border-white/20 hover:shadow-lg hover:shadow-primary/5',
            'hover:scale-[1.02] active:scale-[0.98]',
            'animate-fade-in opacity-0 [animation-fill-mode:forwards]',
            selectedId === conv.id && 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/10'
          )}
        >
          {conv.avatar_url ? (
            <img
              src={conv.avatar_url}
              alt={conv.name || 'Channel'}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-primary/30 transition-all"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-violet-400/50 transition-all shadow-lg shadow-violet-500/20">
              <Radio className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate group-hover:text-white transition-colors">{conv.name}</span>
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
        style={{ animationDelay }}
        className={cn(
          'flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 group rounded-xl mx-2 my-1',
          'border border-transparent',
          'hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5',
          'hover:border-white/20 hover:shadow-lg hover:shadow-primary/5',
          'hover:scale-[1.02] active:scale-[0.98]',
          'animate-fade-in opacity-0 [animation-fill-mode:forwards]',
          selectedId === conv.id && 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/10'
        )}
      >
        <div className="ring-2 ring-white/10 group-hover:ring-primary/30 transition-all rounded-full">
          <Avatar
            src={otherProfile.avatar_url}
            name={displayName}
            isOnline={otherProfile.is_online}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate group-hover:text-white transition-colors">{displayName}</span>
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

  const renderSkeleton = () => (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white/5 to-transparent backdrop-blur-xl border-r border-white/10">
      {/* Header with glassmorphism */}
      <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/40 rounded-md animate-ping duration-[2000ms]" />
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="relative z-10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          {/* Glassmorphism search bar */}
          <div className="relative flex-1 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/10 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary/50 focus-visible:border-primary/30 focus-visible:bg-white/15 rounded-xl transition-all duration-300 shadow-inner shadow-black/10"
              />
            </div>
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
          {loading ? (
            renderSkeleton()
          ) : filteredConversations.length === 0 ? (
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
            filteredConversations.map((conv, index) => renderConversationItem(conv, index))
          )}
        </div>
      </div>

      {/* Dual FAB: StudyBuddies (with likes badge) peeking behind + New Message */}
      <div className="absolute bottom-6 right-6 z-50">
        <div className="relative">
          {/* StudyBuddies FAB - peeking from behind with likes badge */}
          <button
            onClick={() => onOpenFindFriends?.()}
            className={cn(
              "absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
              "bg-gradient-to-br from-pink-500 to-rose-600",
              "hover:scale-110 active:scale-95",
              // Position offset to peek from behind (top-left of main FAB)
              "-top-4 -left-4",
              // Pulse glow animation
              "before:absolute before:inset-0 before:rounded-full before:bg-pink-500/40 before:animate-ping"
            )}
            title="StudyBuddies"
          >
            <Users className="h-5 w-5 text-white relative z-10" />

            {/* Likes badge - shows pending likes to entice clicks */}
            {pendingLikesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-400 text-[10px] font-bold text-black flex items-center justify-center shadow-lg animate-bounce z-20">
                +{pendingLikesCount}
              </span>
            )}
          </button>

          {/* Main FAB - New Message (direct action, no expand) */}
          <button
            onClick={() => onOpenMessageFriends?.()}
            className={cn(
              "relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 z-10",
              "bg-gradient-to-br from-primary to-primary/80 hover:shadow-primary/25 hover:shadow-2xl hover:scale-105 active:scale-95"
            )}
            title="New Message"
          >
            <Edit className="h-6 w-6 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
