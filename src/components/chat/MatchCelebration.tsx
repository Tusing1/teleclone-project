import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Sparkles, X, Wand2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';
import { useAIChat } from '@/hooks/useAIChat';
import { toast } from 'sonner';

interface MatchCelebrationProps {
  matchedUser: Profile;
  onClose: () => void;
  onSendMessage: () => void;
  onKeepSwiping?: () => void;
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

export function MatchCelebration({ matchedUser, onClose, onSendMessage, onKeepSwiping }: MatchCelebrationProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [showContent, setShowContent] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [loadingIcebreakers, setLoadingIcebreakers] = useState(false);
  const { generateIcebreakers } = useAIChat();

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

    // Show content with delay
    const t = window.setTimeout(() => setShowContent(true), 300);

    // Load icebreakers
    const loadIcebreakers = async () => {
      setLoadingIcebreakers(true);
      const suggestions = await generateIcebreakers(matchedUser);
      setIcebreakers(suggestions);
      setLoadingIcebreakers(false);
    };
    loadIcebreakers();

    // Sound effect
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
    } catch { }

    return () => window.clearTimeout(t);
  }, [matchedUser]);

  const handleCopyIcebreaker = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Icebreaker copied! Paste it in the chat.");
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
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
          'relative isolate z-10 flex flex-col items-center p-8 max-w-sm mx-4 transition-all duration-500',
          showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-indigo-500/20 blur-3xl animate-pulse-glow" />

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="w-24 h-24 text-pink-500/30 animate-ping" />
          </div>
          <Heart className="w-20 h-20 text-pink-500 fill-pink-500 animate-heart-burst drop-shadow-lg" />
        </div>

        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 mb-2">
          It's a Match!
        </h1>

        <div className="flex items-center gap-1 mb-6">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <p className="text-white/80 text-sm text-center">You and {matchedUser.full_name || matchedUser.username} liked each other</p>
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </div>

        {/* AI Icebreakers Section */}
        <div className="w-full mb-8 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Wand2 className="w-4 h-4 text-pink-400" />
            <span className="text-[10px] font-bold text-pink-200 uppercase tracking-widest">AI Icebreakers</span>
          </div>

          <div className="space-y-2">
            {loadingIcebreakers ? (
              <div className="space-y-2">
                <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl border border-white/10" />
                <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl border border-white/10" />
              </div>
            ) : (
              icebreakers.slice(0, 2).map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopyIcebreaker(text)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/50 transition-all group relative"
                >
                  <p className="text-sm text-white/90 pr-8 italic leading-tight">"{text}"</p>
                  <Copy className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-pink-400 transition-colors" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 w-full">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/20 text-white bg-white/5 hover:bg-white/10"
            onClick={() => {
              onClose();
              onKeepSwiping?.();
            }}
          >
            Later
          </Button>
          <Button
            type="button"
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-xl"
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
