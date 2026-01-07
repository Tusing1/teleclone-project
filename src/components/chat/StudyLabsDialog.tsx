import { useState } from 'react';
import {
    X, FlaskConical, Zap, Trophy, Coins, Play,
    ChevronRight, Brain, Clock, Star, Users, Activity, Pill,
    Microscope, Dna, Timer, Search, Siren, TrendingUp
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { MedicalTermScramble } from '@/components/chat/games/MedicalTermScramble';
import { AnatomyBlitz } from '@/components/chat/games/AnatomyBlitz';
import { PharmMatch } from '@/components/chat/games/PharmMatch';
import { ClinicalCaseCracker } from '@/components/chat/games/ClinicalCaseCracker';
import { TriageMaster } from '@/components/chat/games/TriageMaster';
import { LabValueFlip } from '@/components/chat/games/LabValueFlip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface StudyLabsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type GameView = 'hub' | 'scramble' | 'blitz' | 'pharma' | 'clinical' | 'triage' | 'labflip';

export function StudyLabsDialog({ open, onOpenChange }: StudyLabsDialogProps) {
    const { profile } = useAuth();
    const [activeView, setActiveView] = useState<GameView>('hub');
    const { balance: tokens } = useStudyTokens();
    const [leaderboardTab, setLeaderboardTab] = useState('scramble');
    const { leaderboard: leaders, loading: leadersLoading } = useGameLeaderboard(leaderboardTab);

    const games = [
        {
            id: 'scramble',
            title: 'Term Scramble',
            desc: 'Unscramble complex medical terminology',
            icon: Dna,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/20',
            stats: '3 Levels',
            action: () => setActiveView('scramble')
        },
        {
            id: 'blitz',
            title: 'Anatomy Blitz',
            desc: 'Race against time to identify structures',
            icon: Zap,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            stats: '60s Timer',
            action: () => setActiveView('blitz')
        },
        {
            id: 'pharma',
            title: 'PharmMatch',
            desc: 'Match drugs to their mechanisms',
            icon: Microscope,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            stats: 'Up to 5 TK',
            action: () => setActiveView('pharma')
        },
        {
            id: 'clinical',
            title: 'Case Cracker',
            desc: 'Diagnose patients from symptoms',
            icon: Search,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            stats: 'Detective',
            action: () => setActiveView('clinical')
        },
        {
            id: 'triage',
            title: 'Triage Master',
            desc: 'Prioritize patients in the ER',
            icon: Siren,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            stats: 'High Pace',
            action: () => setActiveView('triage')
        },
        {
            id: 'labflip',
            title: 'Lab Flip',
            desc: 'Guess Lab Values: Higher or Lower?',
            icon: TrendingUp,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/20',
            stats: 'Rapid Fire',
            action: () => setActiveView('labflip')
        }
    ];

    const renderHub = () => (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-6 px-1">
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
                        StudyLabs <Microscope className="h-5 w-5 text-purple-400" />
                    </h2>
                    <p className="text-xs text-white/50 font-medium">Earn tokens through knowledge</p>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-white/30 uppercase tracking-widest">Your Balance</span>
                    <div className="flex items-center gap-1.5 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                        <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="text-sm font-black text-yellow-400 tabular-nums">{tokens}</span>
                        <span className="text-xs font-bold text-yellow-400/50">TK</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="games" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full bg-white/5 border border-white/10 p-1 mb-4 shrink-0">
                    <TabsTrigger
                        value="games"
                        className="flex-1 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white"
                    >
                        Experiments
                    </TabsTrigger>
                    <TabsTrigger
                        value="leaderboard"
                        className="flex-1 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white"
                    >
                        Rankings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="games" className="flex-1 min-h-0 outline-none mt-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 h-full">
                        <div className="space-y-4 pb-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="h-3 w-3 text-purple-400" />
                                <span className="text-xs font-black text-white/30 uppercase tracking-widest">Available Lab Tests</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {games.map((game) => (
                                    <button
                                        key={game.id}
                                        onClick={game.action}
                                        className={cn(
                                            "relative overflow-hidden group p-4 rounded-2xl border transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98]",
                                            game.bg,
                                            game.border,
                                            "hover:border-white/20 hover:bg-white/10"
                                        )}
                                    >
                                        <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${game.color}`}>
                                            <game.icon className="w-12 h-12 rotate-[-12deg]" />
                                        </div>

                                        <div className="relative z-10">
                                            <div className={cn("p-2 rounded-lg bg-black/20 w-fit mb-3", game.color)}>
                                                <game.icon className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-black text-white italic tracking-tight mb-1">{game.title}</h3>
                                            <p className="text-xs text-white/60 font-medium mb-3 line-clamp-2">{game.desc}</p>

                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-black/20 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                                    {game.stats}
                                                </span>
                                                {game.id === 'pharma' && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Trophy className="h-2.5 w-2.5" /> Rewards Ready
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="leaderboard" className="flex-1 min-h-0 outline-none mt-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
                            {['scramble', 'blitz', 'pharma', 'clinical', 'triage', 'labflip'].map((id) => (
                                <button
                                    key={id}
                                    onClick={() => setLeaderboardTab(id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors",
                                        leaderboardTab === id
                                            ? "bg-white text-black"
                                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    {id === 'clinical' ? 'Case' : id === 'labflip' ? 'Lab' : id.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {leadersLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-white/30 space-y-3">
                                <Activity className="h-6 w-6 animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-widest">Calculating Ranking...</span>
                            </div>
                        ) : leaders.length > 0 ? (
                            <div className="space-y-2 pr-2">
                                {leaders.map((leader, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]",
                                            i === 0 && "bg-yellow-500/5 border-yellow-500/20",
                                            i === 1 && "bg-slate-300/5 border-slate-300/20",
                                            i === 2 && "bg-amber-700/5 border-amber-700/20"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black italic",
                                            i === 0 ? "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)] scale-110" :
                                                i === 1 ? "bg-slate-300 text-black" :
                                                    i === 2 ? "bg-amber-700 text-white" :
                                                        "bg-white/5 text-white/30"
                                        )}>
                                            #{i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white text-sm truncate">
                                                {profile?.user_id === leader.user_id ? 'You' : `Agent ${leader.user_id.slice(0, 4)}`}
                                            </div>
                                            <div className="text-[10px] text-white/30 font-medium uppercase tracking-wide">
                                                Scientific Score
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-white text-lg italic tracking-tighter tabular-nums">
                                                {leader.score}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-white/30 space-y-3">
                                <Brain className="h-8 w-8 opacity-20" />
                                <span className="text-xs font-black uppercase tracking-widest">No experimental data yet</span>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) setActiveView('hub');
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-md h-[90vh] sm:h-[600px] p-0 gap-0 bg-[#09090b] border-white/10 overflow-hidden [&>button]:hidden">
                <div className="h-full w-full p-4 overflow-y-auto relative">
                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] opacity-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] opacity-20 pointer-events-none" />

                    <div className={`h-full transition-all duration-300 ${activeView === 'hub' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full absolute inset-0'}`}>
                        {renderHub()}
                    </div>

                    {activeView === 'scramble' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <MedicalTermScramble onExit={() => setActiveView('hub')} />
                        </div>
                    )}

                    {activeView === 'blitz' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <AnatomyBlitz onExit={() => setActiveView('hub')} />
                        </div>
                    )}

                    {activeView === 'pharma' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <PharmMatch onExit={() => setActiveView('hub')} />
                        </div>
                    )}

                    {activeView === 'clinical' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <ClinicalCaseCracker onExit={() => setActiveView('hub')} />
                        </div>
                    )}

                    {activeView === 'triage' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <TriageMaster onExit={() => setActiveView('hub')} />
                        </div>
                    )}

                    {activeView === 'labflip' && (
                        <div className="absolute inset-0 z-10 bg-[#09090b]">
                            <LabValueFlip onExit={() => setActiveView('hub')} />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
