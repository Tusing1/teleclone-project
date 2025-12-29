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

  if (!open) return null;

  const renderDiscoverTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-pink-500/20 border-t-pink-500 animate-spin" />
            <Heart className="absolute inset-0 m-auto h-6 w-6 text-pink-500/50 fill-pink-500/10 animate-pulse" />
          </div>
          <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">
            Deep searching buddies...
          </p>
        </div>
      );
    }

    if (!hasMoreProfiles || !currentProfile) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-8 text-center px-8 relative">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="w-36 h-36 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shadow-2xl relative z-10 backdrop-blur-xl">
              <Sparkles className="h-16 w-16 text-white/20 animate-float-expert" />
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            <h3 className="text-2xl font-black italic tracking-tighter text-white">END OF THE LINE</h3>
            <p className="text-[11px] font-medium text-white/40 max-w-[220px] mx-auto uppercase tracking-widest leading-relaxed">
              You've seen everyone for now. Check back soon for fresh faces!
            </p>
          </div>
          <Button
            className="rounded-full px-10 py-6 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-[0_12px_24px_rgba(255,255,255,0.1)]"
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
      <div className="relative h-full flex flex-col items-center perspective-1000 overflow-hidden pt-4 pb-12">
        {/* Profile card */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cn(
            "w-full max-w-[380px] bg-[#0d0d12] rounded-[40px] shadow-2xl overflow-hidden touch-none border border-white/[0.08] select-none relative group/card",
            !isDragging && "transition-all duration-300 ease-out"
          )}
          style={{
            transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
          }}
        >
          {/* Profile image area */}
          <div className="relative h-[480px] bg-[#08080a]">
            {currentProfile.avatar_url ? (
              <img
                src={currentProfile.avatar_url}
                alt={currentProfile.username}
                className="w-full h-full object-cover pointer-events-none transition-transform duration-700 group-hover/card:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                <div className="w-28 h-28 rounded-[38px] bg-white/[0.03] flex items-center justify-center border border-white/[0.08] transform rotate-[-4deg]">
                  <span className="text-5xl font-black text-white/20">
                    {(currentProfile.full_name || currentProfile.username)[0].toUpperCase()}
                  </span>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] backdrop-blur-md">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">No Photo</p>
                </div>
              </div>
            )}

            {/* Swipe Indicators Overlay */}
            {isDragging && dragOffset.x > 30 && (
              <div className="absolute top-10 left-10 border-[3px] border-green-500 px-6 py-2 rounded-2xl rotate-[-12deg] bg-green-500/10 backdrop-blur-md z-10 transition-opacity" style={{ opacity: Math.min(dragOffset.x / 100, 1) }}>
                <span className="text-3xl font-black text-green-500 uppercase tracking-[0.2em] italic">LIKE</span>
              </div>
            )}
            {isDragging && dragOffset.x < -30 && (
              <div className="absolute top-10 right-10 border-[3px] border-pink-600 px-6 py-2 rounded-2xl rotate-[12deg] bg-pink-600/10 backdrop-blur-md z-10 transition-opacity" style={{ opacity: Math.min(-dragOffset.x / 100, 1) }}>
                <span className="text-3xl font-black text-pink-600 uppercase tracking-[0.2em] italic">NOPE</span>
              </div>
            )}

            {/* Premium Gradient Overlays */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050508] via-[#050508]/40 to-transparent z-10" />
            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/40 to-transparent z-10" />

            {/* Profile info overlay */}
            <div className="absolute bottom-10 left-8 right-8 text-white z-20">
              <div className="flex items-end justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-4xl font-black tracking-tighter italic leading-none drop-shadow-2xl">
                      {currentProfile.full_name || currentProfile.username}
                    </h3>
                    {currentProfile.is_online && (
                      <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-[#050508] shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse mb-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {mutualInterests.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-600 border border-pink-400/50 shadow-lg shadow-pink-600/20">
                        <Users className="w-3 h-3 text-white fill-current" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white">
                          {mutualInterests.length} Mutual
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                      {currentProfile.bio ? "VIEW BIO" : "STUDENT"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Interests Section */}
              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-hidden">
                {currentProfile.interests?.slice(0, 4).map((interest, idx) => {
                  const isMutual = myProfile?.interests?.includes(interest);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "text-[9px] font-black px-4 py-2 rounded-full border transition-all backdrop-blur-3xl uppercase tracking-widest",
                        isMutual
                          ? "bg-white text-black border-white shadow-xl scale-105"
                          : "bg-white/5 text-white/60 border-white/10"
                      )}
                    >
                      {interest}
                    </div>
                  );
                })}
                {currentProfile.interests && currentProfile.interests.length > 4 && (
                  <div className="text-[9px] font-black px-3 py-2 rounded-full border bg-white/5 text-white/30 border-white/5 backdrop-blur-3xl uppercase tracking-widest">
                    +{currentProfile.interests.length - 4} More
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hidden Extra Info (Bio) */}
          {currentProfile.bio && (
            <div className="p-8 pb-10 bg-gradient-to-b from-[#050508] to-[#0d0d12] border-t border-white/[0.03]">
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-[1px] flex-1 bg-white/5" />
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Personal Bio</span>
                  <div className="h-[1px] flex-1 bg-white/5" />
                </div>
                <p className="text-xs leading-relaxed text-white/60 font-medium italic text-center max-w-[280px] mx-auto">
                  "{currentProfile.bio}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-8 mt-10 w-full relative z-10 px-4">
          <button
            className="w-16 h-16 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-2xl flex items-center justify-center group/btn transition-all hover:scale-110 active:scale-90 hover:bg-pink-600 hover:border-pink-500 shadow-2xl"
            onClick={() => handleSwipe('left')}
            disabled={!!swipeDirection}
          >
            <X className="h-7 w-7 text-white/40 group-hover/btn:text-white transition-colors" />
          </button>

          <button
            className="w-20 h-20 rounded-[30px] bg-white flex items-center justify-center group/heart transition-all hover:scale-110 active:scale-90 shadow-[0_20px_50px_-10px_rgba(255,255,255,0.3)] hover:rotate-[-4deg]"
            onClick={() => handleSwipe('right')}
            disabled={!!swipeDirection}
          >
            <Heart className="h-10 w-10 text-black fill-transparent group-hover/heart:fill-black group-hover/heart:scale-110 transition-all" />
          </button>

          <button
            className="w-16 h-16 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-2xl flex items-center justify-center group/spark transition-all hover:scale-110 active:scale-90 hover:bg-white hover:border-white shadow-2xl"
            onClick={() => { }}
          >
            <Sparkles className="h-6 w-6 text-white/40 group-hover/spark:text-black transition-colors" />
          </button>
        </div>
      </div>
    );
  };

  const renderMatchesTab = () => {
    if (matches.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-8 text-center px-8 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-2xl animate-pulse" />
            <div className="w-28 h-28 rounded-[32px] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center relative z-10 backdrop-blur-xl transform rotate-[4deg]">
              <Users className="h-12 w-12 text-white/20" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-black italic tracking-tighter text-white uppercase">Waiting for Sparks</h3>
            <p className="text-[11px] font-medium text-white/40 max-w-[200px] mx-auto uppercase tracking-widest leading-relaxed">
              Matched buddies will appear here once you both like each other.
            </p>
          </div>
          <button
            className="px-8 py-4 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/60 font-black text-[9px] uppercase tracking-[0.3em] hover:bg-white/10 transition-all"
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
            className="flex items-center gap-5 p-5 rounded-[28px] bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer group/match relative overflow-hidden active:scale-[0.98]"
            onClick={() => handleOpenMatch(match.conversation_id)}
          >
            <div className="relative">
              <Avatar
                src={match.matchedUser?.avatar_url}
                name={match.matchedUser?.full_name || match.matchedUser?.username || 'User'}
                size="lg"
                className="ring-2 ring-white/10 transition-transform group-hover/match:scale-105"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-pink-600 rounded-full flex items-center justify-center border-2 border-[#050508] shadow-lg">
                <Heart className="h-3 w-3 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-lg tracking-tight text-white/90 group-hover/match:text-white transition-colors">
                {match.matchedUser?.full_name || match.matchedUser?.username}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                  Matched {new Date(match.matched_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center group-hover/match:bg-white group-hover/match:border-white transition-all">
              <MessageCircle className="h-5 w-5 text-white/40 group-hover/match:text-black transition-colors" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLikesTab = () => {
    if (!canSeeLikes) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-8 text-center px-8 relative">
          <div className="relative group">
            <div className="absolute inset-x-[-20%] inset-y-[-20%] bg-gradient-to-br from-amber-400 to-orange-600 rounded-full blur-3xl opacity-20" />
            <div className="w-32 h-32 rounded-[40px] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center relative z-10 backdrop-blur-2xl transform rotate-[-6deg]">
              <Crown className="h-14 w-14 text-amber-500/40 animate-pulse" />
            </div>
            {likedByCount > 0 && (
              <div className="absolute -top-4 -right-4 bg-pink-600 text-white text-lg font-black px-4 py-1.5 rounded-full border-[3px] border-[#050508] shadow-2xl z-20">
                {likedByCount}
              </div>
            )}
          </div>
          <div className="space-y-3 relative z-10">
            <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase">People Like You!</h3>
            <p className="text-[11px] font-medium text-white/40 max-w-[240px] mx-auto uppercase tracking-widest leading-relaxed">
              {likedByCount} people are already interested in matching with you. Unlock to see them all!
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-full px-12 py-7 bg-gradient-to-r from-amber-400 to-orange-600 text-black font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(245,158,11,0.4)]"
            onClick={() => setShowUnlockOptions(true)}
          >
            <Eye className="h-4 w-4 mr-3" />
            Reveal Matches
          </Button>
        </div>
      );
    }

    if (likedByUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-8 text-center px-8 relative">
          <div className="w-24 h-24 rounded-full bg-white/[0.03] flex items-center justify-center border border-white/[0.08]">
            <Heart className="h-10 w-10 text-white/10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black italic tracking-tighter text-white uppercase">Quiet for now</h3>
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
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
            className="flex items-center gap-5 p-5 rounded-[28px] bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer relative overflow-hidden group/like active:scale-[0.98]"
          >
            <Avatar
              src={like.profile?.avatar_url}
              name={like.profile?.full_name || like.profile?.username || 'User'}
              size="lg"
              className="ring-2 ring-white/10 group-hover/like:scale-105 transition-transform"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-lg tracking-tight text-white/90 group-hover/like:text-white transition-colors">
                {like.profile?.full_name || like.profile?.username}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-pink-500/40" />
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                  Liked you {new Date(like.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-pink-600/10 border border-pink-500/20 flex items-center justify-center group-hover/like:bg-pink-600 group-hover/like:border-pink-500 transition-all">
              <Heart className="h-5 w-5 text-pink-500 fill-pink-500 group-hover/like:text-white group-hover/like:fill-white transition-all transform group-hover/like:scale-110 animate-pulse group-hover/like:animate-none" />
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

      <div className="fixed inset-0 z-[100] bg-[#08080c] flex flex-col overflow-hidden animate-in fade-in duration-700">
        {/* Vibrant Mesh Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-pink-500/[0.18] rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-purple-600/[0.22] rounded-full blur-[180px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[20%] right-[10%] w-[50%] h-[50%] bg-orange-500/[0.12] rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-[30%] left-[10%] w-[40%] h-[40%] bg-indigo-500/[0.15] rounded-full blur-[110px] animate-pulse" style={{ animationDelay: '3s' }} />

          {/* Subtle Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
        </div>

        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full relative z-10 px-6 pt-10 md:pt-14">
          {/* Minimalist Close Button */}
          <button
            onClick={onClose}
            className="absolute right-6 top-8 p-3 rounded-full bg-white/[0.03] border border-white/[0.08] text-white/30 hover:text-white transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-90 z-[110] backdrop-blur-3xl"
          >
            <X className="w-5 h-5" />
          </button>

          <header className="mb-12 text-center">
            <div className="inline-flex items-center gap-5 mb-3 group">
              <div className="w-14 h-14 rounded-[22px] bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center transform rotate-[-6deg] shadow-[0_12px_32px_-8px_rgba(236,72,153,0.5)] transition-transform group-hover:rotate-[0deg] duration-500">
                <Heart className="h-7 w-7 text-white fill-white" />
              </div>
              <div className="text-left">
                <h2 className="text-3xl font-black italic tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
                  STUDYBUDDIES
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-[2px] w-4 bg-pink-500/50 rounded-full" />
                  <p className="text-[11px] font-black text-pink-500 uppercase tracking-[0.4em] leading-tight">
                    Discovery
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced Glassmorphic Tabs */}
            <div className="mt-10 flex bg-white/[0.02] backdrop-blur-3xl rounded-full p-2 border border-white/[0.06] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => setActiveTab('discover')}
                className={cn(
                  "flex-1 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-full relative overflow-hidden group/tab",
                  activeTab === 'discover'
                    ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]"
                    : "text-white/30 hover:text-white/80"
                )}
              >
                <div className="flex items-center justify-center gap-2.5 relative z-10">
                  <Sparkles className={cn("h-3.5 w-3.5 transition-transform group-hover/tab:rotate-12", activeTab === 'discover' ? "text-pink-600" : "text-white/10")} />
                  Discover
                </div>
              </button>
              <button
                onClick={() => setActiveTab('matches')}
                className={cn(
                  "flex-1 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-full relative overflow-hidden group/tab",
                  activeTab === 'matches'
                    ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]"
                    : "text-white/30 hover:text-white/80"
                )}
              >
                <div className="flex items-center justify-center gap-2.5 relative z-10">
                  <Users className={cn("h-3.5 w-3.5 transition-transform group-hover/tab:scale-110", activeTab === 'matches' ? "text-purple-600" : "text-white/10")} />
                  Matches
                  {matches.length > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-black text-white ms-2 shadow-lg shadow-pink-500/30 animate-pulse">
                      {matches.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('likes')}
                className={cn(
                  "flex-1 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-full relative overflow-hidden group/tab",
                  activeTab === 'likes'
                    ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.2)]"
                    : "text-white/30 hover:text-white/80"
                )}
              >
                <div className="flex items-center justify-center gap-2.5 relative z-10">
                  <Heart className={cn("h-3.5 w-3.5 transition-transform group-hover/tab:scale-125", activeTab === 'likes' ? "text-rose-600 fill-rose-600/20" : "text-white/10")} />
                  Likes
                </div>
              </button>
            </div>
          </header>

          {/* Premium Immersive Viewport */}
          <main className="flex-1 overflow-y-auto custom-scrollbar relative px-1">
            <div className="max-w-md mx-auto py-2 h-full">
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

      {/* Unlock Options Alert Dialog */}
      <AlertDialog open={showUnlockOptions} onOpenChange={setShowUnlockOptions}>
        <AlertDialogContent className="bg-[#0a0a0f] border-white/[0.08] text-white rounded-[40px] p-0 overflow-hidden max-w-sm shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
          <div className="relative p-8">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-amber-500/10 rounded-full blur-[80px]" />
            </div>

            <AlertDialogHeader className="relative z-10 text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-[30px] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-2 transform rotate-[-4deg]">
                <Crown className="h-10 w-10 text-white fill-white/20" />
              </div>
              <AlertDialogTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                Unlock Elite Access
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[11px] font-medium text-white/40 uppercase tracking-widest leading-relaxed max-w-[240px] mx-auto">
                Ready to see who's secretly crushing on you? Match instantly!
              </AlertDialogDescription>

              <div className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between backdrop-blur-md">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Your Balance</span>
                <span className="font-black text-amber-500 text-lg tabular-nums">
                  {balance} <span className="text-[10px] uppercase text-amber-500/50">TK</span>
                </span>
              </div>
            </AlertDialogHeader>

            <div className="grid gap-4 mt-8 relative z-10">
              <button
                onClick={() => handleUnlockLikes('daily')}
                className="flex items-center justify-between p-5 rounded-[24px] bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20 transition-all group/plan active:scale-95"
              >
                <div className="text-left">
                  <div className="font-black text-sm text-white/90 group-hover/plan:text-white uppercase tracking-tighter">24H Discovery</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Quick Peek</div>
                </div>
                <div className="font-black text-lg text-amber-500">100 TK</div>
              </button>

              <button
                onClick={() => handleUnlockLikes('weekly')}
                className="flex items-center justify-between p-6 rounded-[24px] bg-white border-none transition-all group/plan active:scale-95 relative overflow-hidden shadow-2xl shadow-white/10"
              >
                <div className="absolute top-0 right-0 bg-pink-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest animate-pulse">
                  Best Value
                </div>
                <div className="text-left">
                  <div className="font-black text-sm text-black uppercase tracking-tighter">7-Day Unlimited</div>
                  <div className="text-[10px] text-black/40 uppercase tracking-widest mt-0.5 whitespace-nowrap">Match all week long</div>
                </div>
                <div className="font-black text-xl text-black">350 TK</div>
              </button>
            </div>

            <AlertDialogFooter className="mt-8 flex justify-center !sm:justify-center relative z-10">
              <AlertDialogCancel className="bg-transparent border-none text-white/20 hover:text-white/60 hover:bg-transparent transition-colors uppercase text-[10px] font-black tracking-[0.3em]">
                Maybe later
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
