import { useState, useRef } from 'react';
import { 
  Heart, X, Sparkles, Users, Crown, ChevronLeft, 
  MessageCircle, Eye, Loader2 
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
import { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';

interface FindFriendsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}

type TabType = 'discover' | 'matches' | 'likes';

export function FindFriendsDialog({ open, onClose, onOpenConversation }: FindFriendsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [matchAnimation, setMatchAnimation] = useState<Profile | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const {
    currentProfile,
    hasMoreProfiles,
    matches,
    likedByCount,
    likedByUsers,
    canSeeLikes,
    loading,
    swipe,
    unlockSeeLikes
  } = useFindFriends();

  const handleSwipe = async (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    
    // Animate card out
    setTimeout(async () => {
      const result = await swipe(direction);
      setSwipeDirection(null);
      
      if (result?.matched && result.user) {
        setMatchAnimation(result.user);
        // Auto-dismiss match animation after 3s
        setTimeout(() => setMatchAnimation(null), 3000);
      }
    }, 300);
  };

  const handleOpenMatch = (conversationId: string | null) => {
    if (conversationId) {
      onOpenConversation(conversationId);
      onClose();
    }
  };

  const handleUnlockLikes = async () => {
    await unlockSeeLikes();
  };

  const renderDiscoverTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Finding people near you...</p>
        </div>
      );
    }

    if (!hasMoreProfiles || !currentProfile) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-semibold">No more people to show</h3>
          <p className="text-muted-foreground">
            You've seen everyone! Check back later for new users.
          </p>
        </div>
      );
    }

    return (
      <div className="relative h-[450px] flex flex-col items-center">
        {/* Match animation overlay */}
        {matchAnimation && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/90 to-purple-600/90 rounded-xl animate-in fade-in zoom-in duration-300">
            <div className="animate-bounce mb-4">
              <Heart className="h-16 w-16 text-white fill-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">It's a Match!</h2>
            <p className="text-white/90 mb-6">You and {matchAnimation.full_name || matchAnimation.username} liked each other</p>
            <div className="flex gap-4">
              <Button 
                variant="secondary" 
                onClick={() => setMatchAnimation(null)}
              >
                Keep Swiping
              </Button>
              <Button 
                className="bg-white text-purple-600 hover:bg-white/90"
                onClick={() => {
                  const match = matches.find(m => 
                    m.matchedUser?.user_id === matchAnimation.user_id
                  );
                  if (match?.conversation_id) {
                    handleOpenMatch(match.conversation_id);
                  }
                  setMatchAnimation(null);
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </div>
          </div>
        )}

        {/* Profile card */}
        <div
          ref={cardRef}
          className={cn(
            "w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden transition-all duration-300",
            swipeDirection === 'left' && "translate-x-[-150%] rotate-[-20deg] opacity-0",
            swipeDirection === 'right' && "translate-x-[150%] rotate-[20deg] opacity-0"
          )}
        >
          {/* Profile image area */}
          <div className="relative h-72 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600">
            {currentProfile.avatar_url ? (
              <img 
                src={currentProfile.avatar_url} 
                alt={currentProfile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl font-bold text-white/50">
                  {(currentProfile.full_name || currentProfile.username)[0].toUpperCase()}
                </span>
              </div>
            )}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Profile info overlay */}
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h3 className="text-2xl font-bold">
                {currentProfile.full_name || currentProfile.username}
              </h3>
              <p className="text-white/80">@{currentProfile.username}</p>
              {currentProfile.is_online && (
                <Badge className="mt-2 bg-green-500 text-white">Online</Badge>
              )}
            </div>
          </div>

          {/* Bio and interests section */}
          <div className="p-4 space-y-3">
            <p className="text-muted-foreground text-sm line-clamp-2">
              {currentProfile.bio || "No bio yet. Say hi and get to know them!"}
            </p>
            
            {/* Interests */}
            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentProfile.interests.slice(0, 5).map((interest, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary"
                    className="text-xs"
                  >
                    {interest}
                  </Badge>
                ))}
                {currentProfile.interests.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{currentProfile.interests.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <Button
            size="lg"
            variant="outline"
            className="w-16 h-16 rounded-full border-2 border-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all hover:scale-110"
            onClick={() => handleSwipe('left')}
            disabled={!!swipeDirection}
          >
            <X className="h-8 w-8 text-red-500" />
          </Button>
          
          <Button
            size="lg"
            className="w-20 h-20 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all hover:scale-110 shadow-lg"
            onClick={() => handleSwipe('right')}
            disabled={!!swipeDirection}
          >
            <Heart className="h-10 w-10 text-white" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMatchesTab = () => {
    if (matches.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-6">
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
      <div className="space-y-3 max-h-[450px] overflow-y-auto">
        {matches.map(match => (
          <div 
            key={match.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
            onClick={() => handleOpenMatch(match.conversation_id)}
          >
            <Avatar
              src={match.matchedUser?.avatar_url}
              name={match.matchedUser?.full_name || match.matchedUser?.username || 'User'}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">
                {match.matchedUser?.full_name || match.matchedUser?.username}
              </h4>
              <p className="text-sm text-muted-foreground">
                Matched {new Date(match.matched_at).toLocaleDateString()}
              </p>
            </div>
            <Button size="sm" variant="ghost">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  const renderLikesTab = () => {
    if (!canSeeLikes) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="h-12 w-12 text-white" />
            </div>
            {likedByCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-pink-500 text-white text-lg px-3">
                {likedByCount}
              </Badge>
            )}
          </div>
          <h3 className="text-xl font-semibold">
            {likedByCount} people liked you!
          </h3>
          <p className="text-muted-foreground">
            Unlock to see who's interested in you and match instantly.
          </p>
          <Button 
            className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600"
            onClick={handleUnlockLikes}
          >
            <Eye className="h-4 w-4 mr-2" />
            See Who Likes You
          </Button>
        </div>
      );
    }

    if (likedByUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Heart className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-semibold">No pending likes</h3>
          <p className="text-muted-foreground">
            When someone likes you, they'll appear here!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[450px] overflow-y-auto">
        {likedByUsers.map(like => (
          <div 
            key={like.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20"
          >
            <Avatar
              src={like.profile?.avatar_url}
              name={like.profile?.full_name || like.profile?.username || 'User'}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">
                {like.profile?.full_name || like.profile?.username}
              </h4>
              <p className="text-sm text-muted-foreground">
                Liked you {new Date(like.created_at).toLocaleDateString()}
              </p>
            </div>
            <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
              <Heart className="h-4 w-4 text-white" />
            </div>
            Find Friends
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('discover')}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === 'discover' 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4 inline mr-1" />
            Discover
            {activeTab === 'discover' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === 'matches' 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4 inline mr-1" />
            Matches
            {matches.length > 0 && (
              <Badge className="ml-1 bg-pink-500 text-white text-xs">{matches.length}</Badge>
            )}
            {activeTab === 'matches' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === 'likes' 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className="h-4 w-4 inline mr-1" />
            Likes
            {likedByCount > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white text-xs">{likedByCount}</Badge>
            )}
            {activeTab === 'likes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600" />
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="p-6 pt-4">
          {activeTab === 'discover' && renderDiscoverTab()}
          {activeTab === 'matches' && renderMatchesTab()}
          {activeTab === 'likes' && renderLikesTab()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
