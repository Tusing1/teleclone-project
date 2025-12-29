import { useState, useRef } from 'react';
import {
  Heart, X, Sparkles, Users, Crown, ChevronLeft,
  MessageCircle, Eye, Loader2, Wand2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { Badge } from '@/components/ui/badge';
import { useFindFriends } from '@/hooks/useFindFriends';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';
import { MatchCelebration } from './MatchCelebration';

interface FindFriendsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}

import { useStudyTokens } from '@/hooks/useStudyTokens';
import { AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TabType = 'discover' | 'matches' | 'likes';

export function FindFriendsDialog({ open, onClose, onOpenConversation }: FindFriendsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [matchAnimation, setMatchAnimation] = useState<{ user: Profile; conversationId: string } | null>(null);
  const [showUnlockOptions, setShowUnlockOptions] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Drag-to-swipe state
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const { balance, unlockPremiumWithTokens } = useStudyTokens();
  const { profile: myProfile } = useAuth();

  const {
    currentProfile,
    hasMoreProfiles,
    matches,
    likedByCount,
    likedByUsers,
    canSeeLikes,
    fetchCanSeeLikes,
    loading,
    swipe,
    unlockSeeLikes
  } = useFindFriends();

  const handleSwipe = async (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    setDragOffset({ x: direction === 'right' ? 500 : -500, y: 0 });

    // Animate card out
    setTimeout(async () => {
      const result = await swipe(direction);
      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);

      if (result?.matched && result.user && result.conversationId) {
        setMatchAnimation({ user: result.user, conversationId: result.conversationId });
      }
    }, 300);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (swipeDirection) return;
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart || swipeDirection) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragOffset({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart || swipeDirection) return;
    const dx = e.clientX - dragStart.x;

    // Threshold for swipe: 100px
    if (dx > 100) {
      handleSwipe('right');
    } else if (dx < -100) {
      handleSwipe('left');
    } else {
      // Snap back
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
    }
    setDragStart(null);
  };

  const handleOpenMatch = (conversationId: string | null) => {
    if (conversationId) {
      onOpenConversation(conversationId);
      onClose();
    }
  };

  const handleUnlockLikes = async (choice: 'daily' | 'weekly') => {
    const feature = choice === 'daily' ? 'SEE_WHO_LIKES_DAILY' : 'SEE_WHO_LIKES_WEEKLY';
    const success = await unlockPremiumWithTokens(feature);
    if (success) {
      setShowUnlockOptions(false);
      await fetchCanSeeLikes();
    }
  };

  const renderDiscoverTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[550px] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Finding your study buddies...</p>
        </div>
      );
    }

    if (!hasMoreProfiles || !currentProfile) {
      return (
        <div className="flex flex-col items-center justify-center h-[550px] gap-6 text-center px-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl">
              <Sparkles className="h-16 w-16 text-white animate-pulse" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-background animate-bounce">
              <span className="text-xs font-black">!</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">No more buddies for now</h3>
            <p className="text-muted-foreground max-w-[250px] mx-auto">
              You've reached the end of the list! Why not check your matches while you wait?
            </p>
          </div>
          <Button
            className="rounded-full px-8 bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-105 transition-transform"
            onClick={() => setActiveTab('matches')}
          >
            Go to Matches
          </Button>
        </div>
      );
    }

    const rotation = dragOffset.x / 10;
    const opacity = 1 - Math.abs(dragOffset.x) / 500;
    const mutualInterests = currentProfile.interests?.filter(i => myProfile?.interests?.includes(i)) || [];

    return (
      <div className="relative h-[650px] flex flex-col items-center perspective-1000 overflow-hidden">

        {/* Profile card */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cn(
            "w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden touch-none border border-white/10 select-none",
            !isDragging && "transition-all duration-300 ease-out"
          )}
          style={{
            transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
          }}
        >
          {/* Profile image area */}
          <div className="relative h-96 bg-gradient-to-br from-gray-900 to-slate-800">
            {currentProfile.avatar_url ? (
              <img
                src={currentProfile.avatar_url}
                alt={currentProfile.username}
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="text-5xl font-bold text-white/30">
                    {(currentProfile.full_name || currentProfile.username)[0].toUpperCase()}
                  </span>
                </div>
                <Users className="h-6 w-6 text-white/20" />
              </div>
            )}

            {/* Swipe Indicators Overlay */}
            {isDragging && dragOffset.x > 30 && (
              <div className="absolute top-8 left-8 border-4 border-green-500 px-4 py-1 rounded-xl rotate-[-15deg] bg-green-500/10 backdrop-blur-sm z-10 transition-opacity" style={{ opacity: Math.min(dragOffset.x / 100, 1) }}>
                <span className="text-2xl font-black text-green-500 uppercase tracking-widest">LIKE</span>
              </div>
            )}
            {isDragging && dragOffset.x < -30 && (
              <div className="absolute top-8 right-8 border-4 border-red-500 px-4 py-1 rounded-xl rotate-[15deg] bg-red-500/10 backdrop-blur-sm z-10 transition-opacity" style={{ opacity: Math.min(-dragOffset.x / 100, 1) }}>
                <span className="text-2xl font-black text-red-500 uppercase tracking-widest">NOPE</span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            {/* Profile info overlay */}
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-black tracking-tight drop-shadow-lg">
                  {currentProfile.full_name || currentProfile.username}
                </h3>
                {currentProfile.is_online && (
                  <div className="w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {mutualInterests.length > 0 && (
                  <Badge variant="secondary" className="bg-pink-500 text-white border-none text-[10px] font-black px-2 py-0.5 shadow-lg">
                    {mutualInterests.length} MUTUAL
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Bio and interests section */}
          <div className="p-5 space-y-3 bg-gradient-to-b from-card to-background max-h-[220px] overflow-y-auto custom-scrollbar">
            {currentProfile.bio && (
              <div className="space-y-1">
                <span className="text-[10px] font-black text-pink-500/60 uppercase tracking-[0.2em]">About</span>
                <p className="text-sm leading-relaxed text-foreground/90 font-medium line-clamp-3">
                  {currentProfile.bio}
                </p>
              </div>
            )}

            {/* Interests Section */}
            <div className="space-y-2 pb-2">
              <span className="text-[10px] font-black text-purple-500/60 uppercase tracking-[0.2em]">Interests</span>
              <div className="flex flex-wrap gap-1.5">
                {currentProfile.interests?.map((interest, idx) => {
                  const isMutual = myProfile?.interests?.includes(interest);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all duration-200",
                        isMutual
                          ? "bg-pink-500 text-white border-pink-400 shadow-sm scale-105"
                          : "bg-secondary/50 text-secondary-foreground border-border/50"
                      )}
                    >
                      {interest}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8 mt-4 pb-4 w-full">
          <Button
            size="lg"
            variant="outline"
            className="w-16 h-16 rounded-full border-2 border-red-500/20 bg-background/50 backdrop-blur-md hover:bg-red-500/10 hover:border-red-500/50 hover:scale-110 active:scale-95 transition-all shadow-xl group"
            onClick={() => handleSwipe('left')}
            disabled={!!swipeDirection}
          >
            <X className="h-8 w-8 text-red-500 group-hover:scale-110 transition-transform" />
          </Button>

          <Button
            size="lg"
            className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 hover:scale-110 active:scale-90 transition-all shadow-[0_10px_30px_rgba(236,72,153,0.5)] group relative overflow-hidden"
            onClick={() => handleSwipe('right')}
            disabled={!!swipeDirection}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Heart className="h-10 w-10 text-white group-hover:fill-white group-hover:scale-110 transition-all" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-12 h-12 rounded-full border border-yellow-500/20 bg-background/50 backdrop-blur-md hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all shadow-lg"
            onClick={() => { }}
          >
            <Sparkles className="h-5 w-5 text-yellow-500" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMatchesTab = () => {
    if (matches.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[550px] gap-4 text-center px-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Users className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-semibold">No matches yet</h3>
          <p className="text-muted-foreground">
            Keep swiping! When someone likes you back, they'll appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[550px] overflow-y-auto px-2 pb-6">
        {matches.map(match => (
          <div
            key={match.id}
            className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border/50 hover:border-pink-500/30 hover:bg-pink-500/5 transition-all cursor-pointer group"
            onClick={() => handleOpenMatch(match.conversation_id)}
          >
            <div className="relative">
              <Avatar
                src={match.matchedUser?.avatar_url}
                name={match.matchedUser?.full_name || match.matchedUser?.username || 'User'}
                size="lg"
                className="ring-2 ring-pink-500/20"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center border-2 border-background">
                <Heart className="h-2.5 w-2.5 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-lg truncate group-hover:text-pink-500 transition-colors">
                {match.matchedUser?.full_name || match.matchedUser?.username}
              </h4>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">
                Matched {new Date(match.matched_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="rounded-full text-pink-400 hover:text-pink-500 hover:bg-pink-500/10">
                <MessageCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLikesTab = () => {
    if (!canSeeLikes) {
      return (
        <div className="flex flex-col items-center justify-center h-[550px] gap-6 text-center px-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-2xl">
              <Crown className="h-16 w-16 text-white animate-pulse" />
            </div>
            {likedByCount > 0 && (
              <Badge className="absolute -top-3 -right-3 bg-pink-500 text-white text-xl px-4 py-1.5 rounded-full border-4 border-background shadow-lg">
                {likedByCount}
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">
              {likedByCount} people like you!
            </h3>
            <p className="text-muted-foreground max-w-[280px] mx-auto">
              Unlock Premium to see who's already interested in you and start chatting instantly.
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-full px-10 bg-gradient-to-r from-amber-400 to-orange-600 hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(245,158,11,0.3)]"
            onClick={() => setShowUnlockOptions(true)}
          >
            <Eye className="h-5 w-5 mr-3" />
            Show My Likes
          </Button>
        </div>
      );
    }

    if (likedByUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[550px] gap-6 text-center px-8">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground opacity-20" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold">No pending likes</h3>
            <p className="text-muted-foreground">
              When someone likes you, they'll appear here!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[550px] overflow-y-auto px-2 pb-6">
        {likedByUsers.map(like => (
          <div
            key={like.id}
            className="flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-r from-pink-500/5 to-purple-500/5 border border-pink-500/10 hover:border-pink-500/30 transition-all cursor-pointer group"
          >
            <Avatar
              src={like.profile?.avatar_url}
              name={like.profile?.full_name || like.profile?.username || 'User'}
              size="lg"
              className="ring-2 ring-pink-500/10"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-lg truncate">
                {like.profile?.full_name || like.profile?.username}
              </h4>
              <p className="text-xs text-muted-foreground font-medium">
                Liked you {new Date(like.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-sm">
              <Heart className="h-5 w-5 text-pink-500 fill-pink-500 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Match Celebration Modal */}
      {matchAnimation && (
        <MatchCelebration
          matchedUser={matchAnimation.user}
          onClose={() => setMatchAnimation(null)}
          onKeepSwiping={() => setActiveTab('discover')}
          onSendMessage={() => {
            handleOpenMatch(matchAnimation.conversationId);
            setMatchAnimation(null);
          }}
        />
      )}

      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-background border-border/50 shadow-2xl rounded-[40px]">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black italic tracking-tighter">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center transform rotate-[-6deg] shadow-lg">
                <Heart className="h-5 w-5 text-white fill-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
                STUDYBUDDIES
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex px-4 mx-4 mb-2 bg-secondary/30 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('discover')}
              className={cn(
                "flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-xl relative overflow-hidden",
                activeTab === 'discover'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className={cn("h-3.5 w-3.5", activeTab === 'discover' && "text-pink-500")} />
                Discover
              </div>
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={cn(
                "flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-xl relative overflow-hidden",
                activeTab === 'matches'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className={cn("h-3.5 w-3.5", activeTab === 'matches' && "text-purple-500")} />
                Matches
                {matches.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] text-white">
                    {matches.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('likes')}
              className={cn(
                "flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-xl relative overflow-hidden",
                activeTab === 'likes'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Heart className={cn("h-3.5 w-3.5", activeTab === 'likes' && "text-pink-500 fill-pink-500/20")} />
                Likes
                {likedByCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white">
                    {likedByCount}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Tab content */}
          <div className="p-0">
            {activeTab === 'discover' && <div className="px-8 pb-8">{renderDiscoverTab()}</div>}
            {activeTab === 'matches' && <div className="px-8 pb-8">{renderMatchesTab()}</div>}
            {activeTab === 'likes' && <div className="px-8 pb-8">{renderLikesTab()}</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Options Alert Dialog */}
      <AlertDialog open={showUnlockOptions} onOpenChange={setShowUnlockOptions}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              Unlock Premium Access
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Choose your plan to see who liked you and match instantly!
              <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs flex items-center justify-between">
                <span>Your Balance:</span>
                <span className="font-bold text-amber-400">{balance} Tokens</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 my-4">
            <button
              onClick={() => handleUnlockLikes('daily')}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 transition-colors group"
            >
              <div className="text-left">
                <div className="font-bold">24 Hours Access</div>
                <div className="text-xs text-slate-400">Perfect for a quick look</div>
              </div>
              <div className="font-bold text-lg text-amber-400">100 TK</div>
            </button>
            <button
              onClick={() => handleUnlockLikes('weekly')}
              className="flex items-center justify-between p-4 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 transition-colors relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                BEST VALUE
              </div>
              <div className="text-left">
                <div className="font-bold">1 Week Unlimited</div>
                <div className="text-xs text-slate-400">Match all week long</div>
              </div>
              <div className="font-bold text-lg text-amber-400">350 TK</div>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-slate-700 text-white hover:bg-white/5">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
