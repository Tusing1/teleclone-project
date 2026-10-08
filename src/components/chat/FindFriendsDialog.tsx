import { useState, useRef } from 'react';
import {
  Heart, X, Sparkles, Users, ChevronLeft,
  MessageCircle, Loader2, Wand2
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


type TabType = 'discover' | 'matches' | 'likes';

export function FindFriendsDialog({ open, onClose, onOpenConversation }: FindFriendsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [matchAnimation, setMatchAnimation] = useState<{ user: Profile; conversationId: string } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Drag-to-swipe state
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
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
    // @ts-expect-error Pointer capture is supported by the browser target.
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


  if (!open) return null;

  const renderDiscoverTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[340px] gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-pink-500/20 border-t-pink-500 animate-spin" />
            <Heart className="absolute inset-0 m-auto h-6 w-6 text-pink-500/50 fill-pink-500/10 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Finding study buddies...
          </p>
        </div>
      );
    }

    if (!hasMoreProfiles || !currentProfile) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[340px] gap-8 text-center px-8 relative">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="w-36 h-36 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shadow-2xl relative z-10 backdrop-blur-xl">
              <Sparkles className="h-16 w-16 text-white/20 animate-float-expert" />
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">You’re all caught up.</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
              You've seen everyone for now. Check back soon for fresh faces!
            </p>
          </div>
          <Button
            className="rounded-2xl px-6 py-3 bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_12px_24px_rgba(255,255,255,0.1)]"
            onClick={() => setActiveTab('matches')}
          >
            Go to Matches
          </Button>
        </div>
      );
    }

    const rotation = dragOffset.x / 10;
    const opacity = 1 - Math.abs(dragOffset.x) / 500;
    const mutualInterests = currentProfile.interests?.filter(interest => myProfile?.interests?.includes(interest)) || [];

    return (
      <div className="relative h-full flex flex-col items-center perspective-1000 overflow-hidden pt-2 pb-6">
        {/* Profile card */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cn(
            "w-full max-w-[380px] bg-[#0d0d12] rounded-[32px] shadow-2xl overflow-hidden touch-none border border-white/[0.08] select-none relative group/card h-[min(440px,58dvh)] md:h-[580px]",
            !isDragging && "transition-all duration-300 ease-out"
          )}
          style={{
            transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
          }}
        >
          {/* Profile image area - Now the full card height */}
          <div className={cn("relative h-full", currentProfile.avatar_url ? "bg-card" : "bg-gradient-to-br from-violet-500/40 via-primary/20 to-card")}>
            {currentProfile.avatar_url ? (
              <img
                src={currentProfile.avatar_url}
                alt={currentProfile.username}
                className="w-full h-full object-cover pointer-events-none transition-transform duration-700 group-hover/card:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 rounded-[34px] bg-primary/30 flex items-center justify-center border border-primary/40 transform rotate-[-4deg]">
                  <span className="text-5xl font-bold text-white/90">
                    {(currentProfile.full_name || currentProfile.username)[0].toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Swipe Indicators Overlay */}
            {isDragging && dragOffset.x > 30 && (
              <div className="absolute top-8 left-8 border-[3px] border-green-500 px-6 py-2 rounded-2xl rotate-[-12deg] bg-green-500/10 backdrop-blur-md z-30 transition-opacity" style={{ opacity: Math.min(dragOffset.x / 100, 1) }}>
                <span className="text-3xl font-black text-green-500 uppercase tracking-[0.2em] italic">LIKE</span>
              </div>
            )}
            {isDragging && dragOffset.x < -30 && (
              <div className="absolute top-8 right-8 border-[3px] border-pink-600 px-6 py-2 rounded-2xl rotate-[12deg] bg-pink-600/10 backdrop-blur-md z-30 transition-opacity" style={{ opacity: Math.min(-dragOffset.x / 100, 1) }}>
                <span className="text-3xl font-black text-pink-600 uppercase tracking-[0.2em] italic">NOPE</span>
              </div>
            )}

            {/* Premium Gradient Overlays */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050508] via-[#050508]/50 to-transparent z-10" />
            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 to-transparent z-10" />

            {/* Profile info overlay (Integrated) */}
            <div className="absolute bottom-5 left-5 right-5 text-white z-20 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-bold tracking-tight leading-none">
                    {currentProfile.full_name || currentProfile.username}
                  </h3>
                  {currentProfile.is_online && (
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#050508] shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {mutualInterests.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-600 border border-pink-400/50 shadow-lg shadow-pink-600/20">
                      <Users className="w-3 h-3 text-white fill-current" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-white">
                        {mutualInterests.length} Mutual
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    Study Buddy
                  </p>
                </div>
              </div>

              {/* Bio snippet */}
              {currentProfile.bio && (
                <p className="text-xs leading-relaxed text-white/70 font-medium line-clamp-2 italic italic-none">
                  "{currentProfile.bio}"
                </p>
              )}

              {/* Interests Section */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentProfile.interests?.slice(0, 4).map((interest, idx) => {
                  const isMutual = myProfile?.interests?.includes(interest);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-full border transition-all backdrop-blur-3xl uppercase tracking-widest",
                        isMutual
                          ? "bg-white text-black border-white shadow-xl scale-105"
                          : "bg-white/10 text-white/70 border-white/10"
                      )}
                    >
                      {interest}
                    </div>
                  );
                })}
                {currentProfile.interests && currentProfile.interests.length > 4 && (
                  <div className="text-xs font-semibold px-2 py-1.5 rounded-full border bg-white/5 text-white/40 border-white/5 backdrop-blur-3xl uppercase tracking-widest">
                    +{currentProfile.interests.length - 4}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls - Compact Trio */}
        <div className="flex items-center justify-center gap-8 mt-4 w-full relative z-30 px-4">
          <button
            className="w-12 h-12 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-2xl flex items-center justify-center group/btn transition-all hover:scale-110 active:scale-90 hover:bg-pink-600 hover:border-pink-500 shadow-xl"
            aria-label="Skip this buddy"
            onClick={() => handleSwipe('left')}
            disabled={!!swipeDirection}
          >
            <X className="h-6 w-6 text-white/40 group-hover/btn:text-white transition-colors" />
          </button>

          <button
            className="w-14 h-14 rounded-2xl bg-[#d6f58b] flex items-center justify-center group/heart transition-all hover:scale-110 active:scale-90 shadow-lg shadow-black/10 hover:rotate-[-4deg]"
            aria-label="Like this buddy"
            onClick={() => handleSwipe('right')}
            disabled={!!swipeDirection}
          >
            <Heart className="h-8 w-8 text-black fill-transparent group-hover/heart:fill-black group-hover/heart:scale-110 transition-all" />
          </button>
        </div>
      </div>
    );
  };

  const renderMatchesTab = () => {
    if (matches.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[340px] gap-8 text-center px-8 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-2xl animate-pulse" />
            <div className="w-28 h-28 rounded-[32px] bg-secondary border border-border flex items-center justify-center relative z-10 backdrop-blur-xl transform rotate-[4deg]">
              <Users className="h-12 w-12 text-primary/60" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-bold tracking-tight text-foreground">Your next study circle.</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
              Matched buddies will appear here once you both like each other.
            </p>
          </div>
          <button
            className="px-8 py-4 rounded-full bg-secondary border border-border text-muted-foreground font-black text-sm uppercase tracking-[0.3em] hover:bg-white/10 transition-all"
            onClick={() => setActiveTab('discover')}
          >
            Start Discovering
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[600px] overflow-y-auto px-1 pb-10 custom-scrollbar">
        {matches.map(match => (
          <div
            key={match.id}
            className="flex items-center gap-4 p-4 rounded-[28px] bg-card border border-border hover:bg-secondary hover:border-primary/30 transition-all cursor-pointer group/match relative overflow-hidden active:scale-[0.98]"
            onClick={() => handleOpenMatch(match.conversation_id)}
          >
            <div className="relative">
              <Avatar
                src={match.matchedUser?.avatar_url}
                name={match.matchedUser?.full_name || match.matchedUser?.username || 'User'}
                size="lg"
                className="ring-2 ring-white/10 transition-transform group-hover/match:scale-105"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center border-2 border-[#050508] shadow-lg">
                <Heart className="h-2.5 w-2.5 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (match.matchedUser) {
                      setMatchAnimation({ user: match.matchedUser, conversationId: match.conversation_id });
                    }
                  }}
                  className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400/20 to-purple-600/20 border border-amber-500/30 hover:scale-110 active:scale-95 transition-all group/magic shadow-lg shadow-amber-500/5"
                  title="View match"
                >
                  <Sparkles className="h-3 w-3 text-amber-500 animate-pulse group-hover/magic:rotate-12" />
                </button>
                <h4 className="font-black text-base tracking-tight text-foreground group-hover/match:text-primary transition-colors truncate">
                  {match.matchedUser?.full_name || match.matchedUser?.username}
                </h4>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  {new Date(match.matched_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-secondary border border-border flex items-center justify-center group-hover/match:bg-white group-hover/match:border-white transition-all">
              <MessageCircle className="h-4 w-4 text-muted-foreground group-hover/match:text-black transition-colors" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLikesTab = () => {
    if (likedByUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[340px] gap-8 text-center px-8 relative">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center border border-border">
            <Heart className="h-10 w-10 text-primary/60" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-foreground">Quiet for now</h3>
            <p className="text-sm font-medium text-muted-foreground">
              No new likes yet. Keep swiping!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[600px] overflow-y-auto px-1 pb-10 custom-scrollbar">
        {likedByUsers.map(like => (
          <div
            key={like.id}
            className="flex items-center gap-5 p-5 rounded-[28px] bg-card border border-border hover:bg-secondary hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden group/like active:scale-[0.98]"
          >
            <Avatar
              src={like.profile?.avatar_url}
              name={like.profile?.full_name || like.profile?.username || 'User'}
              size="lg"
              className="ring-2 ring-white/10 group-hover/like:scale-105 transition-transform"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-lg tracking-tight text-foreground group-hover/like:text-primary transition-colors">
                {like.profile?.full_name || like.profile?.username}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-pink-500/40" />
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  Liked you {new Date(like.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-pink-600/10 border border-pink-500/20 flex items-center justify-center group-hover/like:bg-pink-600 group-hover/like:border-pink-500 transition-all">
              <Heart className="h-5 w-5 text-pink-500 fill-pink-500 group-hover/like:text-primary group-hover/like:fill-white transition-all transform group-hover/like:scale-110 animate-pulse group-hover/like:animate-none" />
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

      <div className="sg-buddy-screen fixed inset-0 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full relative z-10 px-4 pt-2 md:pt-10">
          {/* Minimalist Close Button */}
          <button
            onClick={onClose}
            aria-label="Close buddies"
            className="absolute right-4 top-2 sg-icon-button z-[110]"
          >
            <X className="w-5 h-5" />
          </button>

          <header className="mb-4 text-left px-1">
            <div className="inline-flex items-center gap-3 mb-1 group mt-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-105 duration-300">
                <Heart className="h-4 w-4 text-white fill-white" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-semibold tracking-tight leading-none text-foreground">
                  Find your people.
                </h2>
              </div>
            </div>

            {/* Advanced Glassmorphic Tabs - Ultra Compact */}
            <div className="mt-4 flex bg-card rounded-[1.25rem] p-1 border border-border">
              <button
                onClick={() => setActiveTab('discover')}
                className={cn(
                  "flex-1 py-3 px-3 text-sm font-semibold transition-all rounded-2xl relative overflow-hidden group/tab",
                  activeTab === 'discover'
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-center gap-2 relative z-10">
                  Discover
                </div>
              </button>
              <button
                onClick={() => setActiveTab('matches')}
                className={cn(
                  "flex-1 py-3 px-3 text-sm font-semibold transition-all rounded-2xl relative overflow-hidden group/tab",
                  activeTab === 'matches'
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-center gap-2 relative z-10">
                  Matches
                  {matches.length > 0 && (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pink-500 text-[7px] font-black text-white ms-2 animate-pulse">
                      {matches.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('likes')}
                className={cn(
                  "flex-1 py-3 px-3 text-sm font-semibold transition-all rounded-2xl relative overflow-hidden group/tab",
                  activeTab === 'likes'
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-center gap-2 relative z-10">
                  Likes
                </div>
              </button>
            </div>
          </header>

          {/* Premium Immersive Viewport */}
          <main className="flex-1 overflow-y-auto custom-scrollbar relative px-1">
            <div className="max-w-md mx-auto py-1 h-full">
              {activeTab === 'discover' && renderDiscoverTab()}
              {activeTab === 'matches' && renderMatchesTab()}
              {activeTab === 'likes' && renderLikesTab()}
            </div>
          </main>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes expert-float {
              0%, 100% { transform: translateY(0) rotate(-6deg); }
              50% { transform: translateY(-12px) rotate(-3deg); }
            }
            .animate-float-expert { animation: expert-float 6s ease-in-out infinite; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.03); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.08); }
          `}} />
      </div>

    </>
  );
}
