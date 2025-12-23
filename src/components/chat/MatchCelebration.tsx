import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';

interface MatchCelebrationProps {
  matchedUser: Profile;
  onClose: () => void;
  onSendMessage: () => void;
}

interface Confetti {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
}

interface FloatingHeart {
  id: number;
  left: number;
  delay: number;
}

export function MatchCelebration({ matchedUser, onClose, onSendMessage }: MatchCelebrationProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Generate confetti
    const colors = ['#ec4899', '#a855f7', '#f472b6', '#c084fc', '#fbbf24', '#34d399'];
    const newConfetti: Confetti[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 5,
    }));
    setConfetti(newConfetti);

    // Generate floating hearts
    const hearts: FloatingHeart[] = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      delay: Math.random() * 2,
    }));
    setFloatingHearts(hearts);

    // Show content with delay for dramatic effect
    setTimeout(() => setShowContent(true), 300);

    // Play sound effect (optional)
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gainNode = audio.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audio.destination);
      oscillator.frequency.setValueAtTime(800, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audio.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audio.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.3);
      oscillator.start(audio.currentTime);
      oscillator.stop(audio.currentTime + 0.3);
    } catch (e) {
      // Audio context not available
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Confetti */}
      {confetti.map((c) => (
        <div
          key={c.id}
          className="absolute top-0 animate-confetti pointer-events-none"
          style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            width: `${c.size}px`,
            height: `${c.size}px`,
            backgroundColor: c.color,
            borderRadius: c.id % 2 === 0 ? '50%' : '0',
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}

      {/* Floating hearts */}
      {floatingHearts.map((h) => (
        <Heart
          key={h.id}
          className="absolute bottom-0 text-pink-500 fill-pink-500 animate-float-up pointer-events-none"
          style={{
            left: `${h.left}%`,
            animationDelay: `${h.delay}s`,
            width: '24px',
            height: '24px',
          }}
        />
      ))}

      {/* Main content */}
      <div
        className={cn(
          "relative flex flex-col items-center p-8 max-w-sm mx-4 transition-all duration-500",
          showContent ? "opacity-100 scale-100" : "opacity-0 scale-75"
        )}
      >
        {/* Glowing background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-indigo-500/20 rounded-3xl blur-3xl animate-pulse-glow" />

        {/* Hearts burst animation */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="w-24 h-24 text-pink-500/30 animate-ping" />
          </div>
          <Heart className="w-20 h-20 text-pink-500 fill-pink-500 animate-heart-burst drop-shadow-lg" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 mb-2 animate-in slide-in-from-bottom duration-500">
          It's a Match!
        </h1>

        <div className="flex items-center gap-1 mb-6">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <p className="text-white/80">You and {matchedUser.full_name || matchedUser.username} liked each other</p>
          <Sparkles className="w-5 h-5 text-yellow-400" />
        </div>

        {/* Matched user avatar */}
        <div className="relative mb-8 animate-in zoom-in duration-700 delay-300">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full blur-lg opacity-50 animate-pulse" />
          <div className="relative w-32 h-32 rounded-full border-4 border-white/50 overflow-hidden shadow-2xl">
            {matchedUser.avatar_url ? (
              <img
                src={matchedUser.avatar_url}
                alt={matchedUser.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <span className="text-4xl font-bold text-white">
                  {(matchedUser.full_name || matchedUser.username)[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 w-full animate-in slide-in-from-bottom duration-500 delay-500">
          <Button
            variant="outline"
            className="flex-1 border-white/30 text-white hover:bg-white/10"
            onClick={onClose}
          >
            Keep Swiping
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg"
            onClick={onSendMessage}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Say Hi!
          </Button>
        </div>
      </div>
    </div>
  );
}