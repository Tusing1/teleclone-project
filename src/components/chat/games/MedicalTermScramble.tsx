import { useState, useEffect, useRef } from 'react';
import {
    Zap, Brain, RefreshCw, Check,
    AlertCircle, Trophy, Play, ArrowRight,
    Clock, Coins, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LEVELS = [
    {
        id: 'novice',
        name: 'Novice',
        color: 'from-blue-500 to-cyan-500',
        timer: 20,
        terms: [
            { term: 'HYPO', hint: 'Under, below, or deficient' },
            { term: 'HYPER', hint: 'Over, above, or excessive' },
            { term: 'ITIS', hint: 'Suffix meaning inflammation' },
            { term: 'PATHY', hint: 'Suffix meaning disease' },
            { term: 'ALGIA', hint: 'Suffix meaning pain' },
            { term: 'CYTO', hint: 'Prefix meaning cell' },
            { term: 'NEPHRO', hint: 'Prefix meaning kidney' },
            { term: 'GASTRO', hint: 'Prefix meaning stomach' }
        ]
    },
    {
        id: 'intern',
        name: 'Intern',
        color: 'from-purple-500 to-pink-500',
        timer: 15,
        terms: [
            { term: 'BRADYCARDIA', hint: 'Slow heart rate (under 60 bpm)' },
            { term: 'HEPATITIS', hint: 'Inflammation of the liver' },
            { term: 'NEPHROLOGY', hint: 'Study of kidney function' },
            { term: 'GASTRITIS', hint: 'Inflammation of the stomach lining' },
            { term: 'DYSPEPSIA', hint: 'Indigestion or upset stomach' },
            { term: 'CYTOLOGY', hint: 'The study of cells' },
            { term: 'RHINITIS', hint: 'Irritation/swelling of nasal mucus' }
        ]
    },
    {
        id: 'specialist',
        name: 'Specialist',
        color: 'from-orange-500 to-rose-600',
        timer: 10,
        terms: [
            { term: 'HYPERTENSION', hint: 'High blood pressure' },
            { term: 'EPINEPHRINE', hint: 'Hormone used in anaphylaxis' },
            { term: 'STETHSCOPE', hint: 'Tool to listen to heart/lungs' },
            { term: 'AUSCULTATION', hint: 'Listening to sounds from heart/lungs' },
            { term: 'PNEUMOTHORAX', hint: 'Collapsed lung' },
            { term: 'MYOCARDIAL', hint: 'Referring to the heart muscle' }
        ]
    }
];

interface MedicalTermScrambleProps {
    onExit: () => void;
}

export function MedicalTermScramble({ onExit }: MedicalTermScrambleProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [levelIdx, setLevelIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [scrambled, setScrambled] = useState('');
    const [input, setInput] = useState('');
    const [score, setScore] = useState(0); // Points for leaderboard
    const [tokensEarned, setTokensEarned] = useState(0); // Actual token reward
    const [timeLeft, setTimeLeft] = useState(15);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('term-scramble');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentLevel = LEVELS[levelIdx];

    const scrambleWord = (word: string) => {
        let result = word.split('').sort(() => Math.random() - 0.5).join('');
        while (result === word && word.length > 1) {
            result = word.split('').sort(() => Math.random() - 0.5).join('');
        }
        return result;
    };

    const startNewRound = (roundIdx: number, lIdx: number = levelIdx) => {
        if (roundIdx >= 3) { // 3 terms per level
            if (lIdx < LEVELS.length - 1) {
                setLevelIdx(lIdx + 1);
                setCurrentRound(0);
                setTimeout(() => startNewRound(0, lIdx + 1), 100);
                return;
            } else {
                endGame();
                return;
            }
        }

        const levelSubTerms = LEVELS[lIdx].terms;
        const nextTerm = levelSubTerms[Math.floor(Math.random() * levelSubTerms.length)];
        setScrambled(scrambleWord(nextTerm.term));
        setCurrentRound(roundIdx);
        setInput('');
        setIsCorrect(null);
        setTimeLeft(LEVELS[lIdx].timer);
        setGameState('playing');
    };

    const checkAnswer = () => {
        const currentTerm = currentLevel.terms.find(t => {
            const sortedScrambled = scrambled.split('').sort().join('');
            const sortedTerm = t.term.split('').sort().join('');
            return sortedScrambled === sortedTerm;
        });

        if (input.toUpperCase() === currentTerm?.term) {
            setIsCorrect(true);
            // Points based on time left and level difficulty
            const roundPoints = 100 + (timeLeft * 10) + (levelIdx * 50);
            setScore(prev => prev + roundPoints);

            toast.success(`Correct! +${roundPoints} points`);
            setTimeout(() => startNewRound(currentRound + 1), 1000);
        } else {
            setIsCorrect(false);
            toast.error('Not quite. Try again!');
        }
    };

    const endGame = async () => {
        setGameState('result');
        if (timerRef.current) clearInterval(timerRef.current);

        // Reward 5 tokens per game session if they reached certain score
        const earned = score > 500 ? 5 : 0;
        setTokensEarned(earned);

        if (earned > 0) {
            await earnTokens(earned, 'game', 'Medical Term Scramble reward');
        }

        // Save high score
        await saveScore(score);
    };

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setIsCorrect(false);
                        setTimeout(() => startNewRound(currentRound + 1), 1000);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentRound, levelIdx]);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/20 rotate-[-6deg]">
                <Brain className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Term Scramble</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Challenge your knowledge across 3 difficulty levels!
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-[320px]">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Clock className="h-4 w-4 text-purple-400 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Levels</span>
                    <span className="text-sm font-black text-white">3 Stages</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Trophy className="h-4 w-4 text-pink-500 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Reward</span>
                    <span className="text-sm font-black text-white">5 Tokens</span>
                </div>
            </div>

            <Button
                onClick={() => {
                    setLevelIdx(0);
                    startNewRound(0, 0);
                }}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Begin Experiment
            </Button>
        </div>
    );

    const renderPlaying = () => {
        const currentTerm = currentLevel.terms.find(t => {
            const sortedScrambled = scrambled.split('').sort().join('');
            const sortedTerm = t.term.split('').sort().join('');
            return sortedScrambled === sortedTerm;
        });

        return (
            <div className="flex flex-col h-full animate-in fade-in duration-500 pt-10">
                <div className="px-4 mb-6">
                    <div className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r shadow-lg transition-all duration-500",
                        currentLevel.color
                    )}>
                        <Star className="h-3 w-3 text-white fill-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] leading-none">{currentLevel.name}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center px-4 mb-16">
                    <div className="space-y-0.5 text-left">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Progress</span>
                        <div className="flex gap-1">
                            {[0, 1, 2].map(idx => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-1 w-6 rounded-full transition-all duration-500",
                                        idx < currentRound ? "bg-white" : idx === currentRound ? "bg-white animate-pulse" : "bg-white/10"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Level Score</span>
                        <span className="text-xl font-black text-white tabular-nums italic tracking-tighter">
                            {score}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block text-right">Timer</span>
                        <span className={cn(
                            "text-2xl font-black italic tracking-tighter tabular-nums text-right inline-block min-w-[40px]",
                            timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-white"
                        )}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start text-center px-4">
                    <div className="relative mb-8">
                        <div className={cn("absolute inset-0 blur-3xl rounded-full opacity-20", currentLevel.color)} />
                        <div className="relative p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.1] backdrop-blur-3xl shadow-2xl">
                            <span className="block text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-4">Unscramble</span>
                            <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">
                                {scrambled}
                            </h3>
                        </div>
                    </div>

                    <div className="w-full max-w-[320px] space-y-6">
                        <div className="relative">
                            <Input
                                value={input}
                                onChange={e => setInput(e.target.value.toUpperCase())}
                                placeholder="TYPE ANSWER..."
                                className={cn(
                                    "h-16 bg-white/[0.03] border-white/10 text-xl font-black tracking-widest uppercase text-center rounded-[24px] focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-white/10",
                                    isCorrect === true && "border-green-500/50 bg-green-500/5",
                                    isCorrect === false && "border-red-500/50 bg-red-500/5 shake"
                                )}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') checkAnswer();
                                }}
                            />
                            {isCorrect === true && <Check className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-green-500 animate-in zoom-in" />}
                            {isCorrect === false && <AlertCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-red-500 animate-in zoom-in" />}
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] relative group overflow-hidden">
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                    <Zap className="h-4 w-4 text-purple-400 fill-purple-400/20" />
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Clinic Hint</span>
                                    <p className="text-[10px] font-bold text-white/70 tracking-tight leading-snug">
                                        {currentTerm?.hint}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={checkAnswer}
                            disabled={!input}
                            className="w-full h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                            Verify Term
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-yellow-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl relative z-10 transform rotate-[8deg]">
                    <Trophy className="h-12 w-12 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Experiment Over</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
                    Final performance score: {score}
                </p>
            </div>

            <div className="w-full max-w-[300px] p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50" />
                <span className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4 relative z-10">Tokens Earned</span>
                <div className="flex items-center justify-center gap-3 relative z-10">
                    <Coins className="h-8 w-8 text-yellow-500" />
                    <span className="text-5xl font-black text-white italic tracking-tighter tabular-nums">{tokensEarned}</span>
                    <span className="text-xl font-black text-yellow-500 pt-2">TK</span>
                </div>
            </div>

            <div className="flex flex-col w-full max-w-[280px] gap-3">
                <Button
                    onClick={onExit}
                    variant="outline"
                    className="h-12 rounded-full border-white/10 bg-white/5 text-white/60 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 hover:text-white transition-all"
                >
                    Exit Lab
                </Button>
                <Button
                    onClick={() => {
                        setScore(0);
                        setLevelIdx(0);
                        startNewRound(0, 0);
                    }}
                    className="h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                    Restart Round
                </Button>
            </div>
        </div>
    );

    return (
        <div className="h-full w-full">
            {gameState === 'start' && renderStart()}
            {gameState === 'playing' && renderPlaying()}
            {gameState === 'result' && renderResult()}
        </div>
    );
}
