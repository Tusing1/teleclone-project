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

        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-500 to-rose-400 mb-2 drop-shadow-sm tracking-tighter italic">
          It's a Match!
        </h1>

        <div className="flex items-center gap-2 mb-8 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <p className="text-white/90 text-xs font-bold uppercase tracking-widest">
            You and {matchedUser.full_name || matchedUser.username} are synced
          </p>
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
        </div>

        {/* AI Icebreakers Section */}
        <div className="w-full mb-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center border border-pink-500/30">
                <Wand2 className="w-3 h-3 text-pink-400" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">AI Icebreakers</span>
            </div>
            {icebreakers.length > 0 && <span className="text-[9px] font-bold text-pink-400/60">TAP TO COPY</span>}
          </div>

          <div className="space-y-3">
            {loadingIcebreakers ? (
              <div className="space-y-3">
                <div className="h-14 w-full bg-white/5 animate-pulse rounded-2xl border border-white/10" />
                <div className="h-14 w-full bg-white/5 animate-pulse rounded-2xl border border-white/10" />
              </div>
            ) : (
              icebreakers.slice(0, 3).map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopyIcebreaker(text)}
                  className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-white/10 to-transparent hover:from-white/15 border border-white/10 hover:border-pink-500/50 transition-all group relative overflow-hidden active:scale-95"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[13px] text-white/90 pr-8 font-medium leading-snug">"{text}"</p>
                  <Copy className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-hover:text-pink-400 transition-colors" />
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
