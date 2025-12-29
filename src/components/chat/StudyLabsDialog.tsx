import { useState } from 'react';
import {
    X, FlaskConical, Zap, Trophy, Coins, Play,
    ChevronRight, Brain, Clock, Star
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { cn } from '@/lib/utils';
import { MedicalTermScramble } from '@/components/chat/games/MedicalTermScramble';

interface StudyLabsDialogProps {
    open: boolean;
    onClose: () => void;
}

type GameView = 'hub' | 'scramble' | 'anatomy' | 'nclex';

export function StudyLabsDialog({ open, onClose }: StudyLabsDialogProps) {
    const { balance } = useStudyTokens();
    const [activeView, setActiveView] = useState<GameView>('hub');

    if (!open) return null;

    const renderHub = () => (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 relative z-20 pt-4">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center transform rotate-[-6deg] shadow-2xl mb-4 animate-float-expert">
                        <FlaskConical className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black italic tracking-tighter leading-none text-white uppercase">
                        StudyLabs
                    </h2>
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mt-2">
                        Play to Earn
                    </p>
                </div>

                {/* Token Balance Card */}
                <div className="mt-8 mx-auto max-w-[280px] p-4 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl flex items-center justify-between shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                            <Coins className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div className="text-left">
                            <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Your Balance</span>
                            <span className="block text-xl font-black text-white tabular-nums">{balance} <span className="text-[10px] text-yellow-500 tracking-normal italic uppercase">TK</span></span>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/[0.08]" />
                    <div className="flex flex-col items-end relative z-10">
                        <Trophy className="h-5 w-5 text-purple-400 mb-1" />
                        <span className="text-[8px] font-black text-purple-400/60 uppercase tracking-widest">Rewards Ready</span>
                    </div>
                </div>
            </header>

            {/* Game Menu */}
            <div className="flex-1 space-y-4 px-2 pb-10 overflow-y-auto custom-scrollbar">
                <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-4">Available Experiments</h3>

                {/* Medical Term Scramble */}
                <button
                    onClick={() => setActiveView('scramble')}
                    className="w-full p-5 rounded-[32px] bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/20 transition-all group/game text-left flex items-center gap-4 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-600/20 transition-all" />

                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30 group-hover:scale-105 transition-transform shrink-0">
                        <Brain className="h-8 w-8 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-lg text-white/90 group-hover:text-white transition-colors uppercase tracking-tight">Term Scramble</h4>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-white/30" />
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">3-5 Min</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-pink-500 fill-pink-500/20" />
                                <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">Up to 50 TK</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-white transition-all group-hover:rotate-[-12deg]">
                        <Play className="h-4 w-4 text-white/40 group-hover:text-black fill-current" />
                    </div>
                </button>

                {/* NCLEX Blitz (Locked/Coming Soon) */}
                <div className="w-full p-5 rounded-[32px] bg-white/[0.01] border border-white/[0.04] opacity-40 transition-all text-left flex items-center gap-4 relative grayscale pointer-events-none">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                        <Star className="h-8 w-8 text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-lg text-white/50 uppercase tracking-tight">NCLEX Dash</h4>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Coming Next Week</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
                        <span className="text-[8px] font-black text-white/40 uppercase">Locked</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-[#050508] flex flex-col overflow-hidden animate-in fade-in duration-700">
            {/* Immersive Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-600/[0.15] rounded-full blur-[140px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-pink-500/[0.15] rounded-full blur-[180px] animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
            </div>

            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full relative z-10 px-4 pt-6">
                {/* Close/Back Button */}
                <button
                    onClick={activeView === 'hub' ? onClose : () => setActiveView('hub')}
                    className="absolute left-4 top-6 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white/40 hover:text-white transition-all active:scale-95 z-[110] backdrop-blur-3xl group"
                >
                    <X className={cn("w-5 h-5 transition-transform", activeView !== 'hub' && "rotate-[-90deg]")} />
                </button>

                {activeView === 'hub' && renderHub()}

                {activeView === 'scramble' && (
                    <MedicalTermScramble
                        onExit={() => setActiveView('hub')}
                    />
                )}
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
        `}} />
        </div>
    );
}
