import { useState, useRef, useCallback } from 'react';
import { Search, Edit, Menu, MoreVertical, Users, Radio, Trash2, RefreshCw, Home, Settings, Heart, Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { NowPlayingBar } from './NowPlayingBar';
import { StudyTermReminder } from './StudyTermReminder';
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
  onOpenFindFriends?: () => void;
  onOpenSavedMessages?: () => void;
  onOpenMessageFriends?: () => void;
  onOpenEditProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenGlobalSearch?: () => void;
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
  onOpenFindFriends,
  onOpenSavedMessages,
  onOpenMessageFriends,
  onOpenEditProfile,
  onOpenSettings,
  onOpenGlobalSearch,
  pendingLikesCount = 0,
  loading = false
}: ConversationListProps) {
  const { user } = useAuth();

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

  const [filter, setFilter] = useState<'all' | 'unread' | 'group' | 'channel'>('all');
  const filteredConversations = conversations.filter(conv => filter === 'all' || (filter === 'unread' ? (conv.unreadCount || 0) > 0 : conv.type === filter));

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
            'flex items-center gap-3 p-3.5 cursor-pointer transition-colors group rounded-[1.25rem] mx-3 my-2 bg-card/70',
            'border border-transparent',
            'hover:bg-secondary',
            'hover:border-border',
            'active:scale-[0.99]',
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate text-foreground transition-colors">{conv.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
            'flex items-center gap-3 p-3.5 cursor-pointer transition-colors group rounded-[1.25rem] mx-3 my-2 bg-card/70',
            'border border-transparent',
            'hover:bg-secondary',
            'hover:border-border',
            'active:scale-[0.99]',
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate text-foreground transition-colors">{conv.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
          'flex items-center gap-3 p-3.5 cursor-pointer transition-colors group rounded-[1.25rem] mx-3 my-2 bg-card/70',
          'border border-transparent',
          'hover:bg-secondary',
          'hover:border-border',
          'active:scale-[0.99]',
          'animate-fade-in opacity-0 [animation-fill-mode:forwards]',
          selectedId === conv.id && 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/10'
        )}
      >
        <div className="ring-2 ring-white/10 group-hover:ring-primary/30 transition-all rounded-full">
          <Avatar
            src={otherProfile.avatar_url}
            name={displayName}
            userId={otherProfile.user_id}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold truncate text-foreground transition-colors">{displayName}</span>
            <div className="flex shrink-0 items-center gap-1">
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
            <div className="flex items-center justify-between gap-2 gap-2">
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
    <div className="relative flex flex-col h-full bg-background">
      {/* Compact mobile-first header */}
      <div className="px-4 pt-5 pb-3 bg-background">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              aria-label="Open StudyGram menu"
              className="sg-icon-button"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground">StudyGram</p>
              <p className="text-xs text-muted-foreground">Study together</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onOpenGlobalSearch && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenGlobalSearch}
                aria-label="Search StudyGram"
                className="sg-icon-button"
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <div className="mb-4 flex items-end justify-between">
          <h1 className="text-[2rem] font-bold leading-none tracking-tight text-foreground">Your circle<span className="text-primary">.</span></h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{conversations.length} chats</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter conversations">
          {([{ id: 'all', label: 'All chats' }, { id: 'unread', label: 'Unread' }, { id: 'group', label: 'Groups' }, { id: 'channel', label: 'Channels' }] as const).map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)} aria-pressed={filter === tab.id} className={cn('shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors', filter === tab.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>{tab.label}</button>
          ))}
        </div>
      </div>
      <NowPlayingBar onOpenSource={source => onSelect(source.conversationId)} />
      <StudyTermReminder onReview={() => onOpenEditProfile?.()} />
      {/* Conversation list with pull-to-refresh */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin relative pb-28 md:pb-0"
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
              <p>{filter === 'all' ? 'Your circle starts here.' : filter === 'unread' ? 'All caught up. No unread chats.' : `No ${filter === 'group' ? 'groups' : 'channels'} here yet.`}</p>
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

      {/* Mobile bottom tab bar: keep the most-used student actions within thumb reach. */}
      <nav className="absolute inset-x-3 bottom-3 z-50 sg-dock px-2 py-2 md:static md:mx-3 md:mb-3 md:block" aria-label="StudyGram navigation">
        <div className="grid grid-cols-5 items-center gap-1">
          <button type="button" className="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-primary" aria-current="page">
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button type="button" onClick={() => onOpenFindFriends?.()} className="relative flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Find study buddies">
            <Heart className="h-5 w-5" />
            <span className="text-[10px] font-medium">Buddies</span>
            {pendingLikesCount > 0 && (
              <span className="absolute right-2 top-0 min-w-4 rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">{pendingLikesCount}</span>
            )}
          </button>

          <button type="button" onClick={() => onOpenMessageFriends?.()} className="flex h-12 w-12 items-center justify-center justify-self-center rounded-2xl bg-[#d6f58b] text-[#192313] shadow-lg shadow-black/10 transition-transform hover:scale-105 active:scale-95" aria-label="New message">
            <Edit className="h-6 w-6" />
          </button>

          <button type="button" onClick={() => onOpenSavedMessages?.()} className="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Saved messages">
            <Bookmark className="h-5 w-5" />
            <span className="text-[10px] font-medium">Saved</span>
          </button>

          <button type="button" onClick={() => onOpenSettings?.()} className="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Open settings">
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
import { BrandMark } from '@/components/BrandMark';
