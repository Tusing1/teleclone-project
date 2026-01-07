import React, { useState, useEffect, useRef } from 'react';
import {
    Activity, ArrowUp, ArrowDown, Check, X,
    Trophy, Play, TrendingUp, Microscope,
    Droplets, Timer, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SCENARIOS = [
    {
        condition: 'Dehydration',
        lab: 'Urine Specific Gravity',
        correct: 'higher',
        reason: 'Kidneys conserve water, concentrating urine.'
    },
    {
        condition: 'Iron Deficiency Anemia',
        lab: 'MCV (Mean Corpuscular Volume)',
        correct: 'lower',
        reason: 'Microcytic anemia causes smaller red blood cells.'
    },
    {
        condition: 'COPD (Chronic Retainer)',
        lab: 'Serum Bicarbonate (HCO3)',
        correct: 'higher',
        reason: 'Compensatory metabolic alkalosis to offset respiratory acidosis.'
    },
    {
        condition: 'SIADH',
        lab: 'Serum Sodium',
        correct: 'lower',
        reason: 'Dilutional hyponatremia due to excess water retention.'
    },
    {
        condition: 'Acute Infection (Bacterial)',
        lab: 'Neutrophils',
        correct: 'higher',
        reason: 'Neutrophilia is the classic response to bacterial infection.'
    },
    {
        condition: 'Vitamin B12 Deficiency',
        lab: 'MCV',
        correct: 'higher',
        reason: 'Megaloblastic anemia causes larger red blood cells.'
    },
    {
        condition: 'Hypothyroidism',
        lab: 'TSH',
        correct: 'higher',
        reason: 'Lack of T3/T4 inhibition causes anterior pituitary to pump out TSH.'
    },
    {
        condition: 'Hyperthyroidism',
        lab: 'TSH',
        correct: 'lower',
        reason: 'Excess T3/T4 suppresses TSH release.'
    }
];

interface LabValueFlipProps {
    onExit: () => void;
}

export function LabValueFlip({ onExit }: LabValueFlipProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [idx, setIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30); // Speed run style
    const [tokensEarned, setTokensEarned] = useState(0);

    // Animation states
    const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('labflip');

    // Shuffle scenarios on mount
    const [shuffledScenarios, setShuffledScenarios] = useState<typeof SCENARIOS>([]);

    useEffect(() => {
        setShuffledScenarios([...SCENARIOS].sort(() => Math.random() - 0.5));
    }, []);

    const current = shuffledScenarios[idx];

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(45);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    endGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleGuess = (direction: 'higher' | 'lower') => {
        if (lastResult) return; // Prevent double click

        const isCorrect = direction === current.correct;

        if (isCorrect) {
            setLastResult('correct');
            setScore(prev => prev + 100 + (streak * 10));
            setStreak(prev => prev + 1);
            toast.success("Correct!", { position: 'top-center', duration: 500 }); // Fast toast
        } else {
            setLastResult('wrong');
            setStreak(0);
            toast.error(`Incorrect. ${current.reason}`, { position: 'top-center', duration: 2000 });
            // Should we reduce time? Maybe for hardcore mode.
        }

        setTimeout(() => {
            setLastResult(null);
            if (idx < shuffledScenarios.length - 1) {
                setIdx(prev => prev + 1);
            } else {
                // All done
                endGame();
            }
        }, 800);
    };

    const endGame = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState('result');
        const earned = score >= 500 ? 5 : 0;
        setTokensEarned(earned);
        if (earned > 0) {
            await earnTokens(earned, 'game', 'Lab Flip reward');
        }
        await saveScore(score);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-2xl relative z-10 rotate-[12deg]">
                    <TrendingUp className="h-12 w-12 text-white" />
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Lab Flip</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Higher or Lower? Fast-paced pathology.
                </p>
            </div>

            <Button
                onClick={() => {
                    setScore(0);
                    setIdx(0);
                    setStreak(0);
                    setGameState('playing');
                    startTimer();
                }}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Start Analysis
            </Button>
        </div>
    );

    const renderPlaying = () => (
        <div className="flex flex-col h-full animate-in fade-in duration-500 pt-6">
            <div className="px-6 mb-8 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Sample</span>
                    <span className="text-xl font-black text-white italic">#{idx + 1}</span>
                </div>

                <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2">
                    <Timer className={cn("h-4 w-4", timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white/50")} />
                    <span className="font-mono font-bold text-white tracking-widest">{timeLeft}s</span>
                </div>

                <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Score</span>
                    <span className="text-xl font-black text-white tabular-nums">{score}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col items-center justify-center relative">
                {/* Result Flash Overlay */}
                {lastResult && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className={cn(
                            "w-full h-full absolute inset-0 opacity-20 animate-in fade-in duration-300",
                            lastResult === 'correct' ? "bg-green-500" : "bg-red-500"
                        )} />
                        {lastResult === 'correct' ? (
                            <Check className="h-32 w-32 text-green-500 animate-in zoom-in spin-in-12 duration-300 drop-shadow-[0_0_50px_rgba(34,197,94,0.5)]" />
                        ) : (
                            <X className="h-32 w-32 text-red-500 animate-in zoom-in duration-300 drop-shadow-[0_0_50px_rgba(239,68,68,0.5)]" />
                        )}
                    </div>
                )}

                <div className="w-full max-w-[320px] mb-12 relative z-10">
                    <div className="bg-white/[0.03] border border-white/[0.1] rounded-[40px] p-8 text-center backdrop-blur-md shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                        <div className="mb-6">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block mb-2">Patient Condition</span>
                            <h3 className="text-2xl font-black text-white italic leading-tight">
                                {current?.condition}
                            </h3>
                        </div>

                        <div className="w-full h-px bg-white/10 my-6" />

                        <div>
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] block mb-2">Target Lab Value</span>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <Microscope className="h-4 w-4 text-blue-400" />
                                <span className="text-lg font-bold text-blue-100">{current?.lab}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-[320px] relative z-10">
                    <button
                        onClick={() => handleGuess('lower')}
                        className="h-32 rounded-[32px] bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 hover:bg-red-500 hover:border-red-400 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                        <ArrowDown className="h-10 w-10 text-red-500 group-hover:text-white transition-colors" />
                        <span className="text-xs font-black text-red-400 uppercase tracking-widest group-hover:text-white">Lower</span>
                    </button>

                    <button
                        onClick={() => handleGuess('higher')}
                        className="h-32 rounded-[32px] bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 hover:bg-green-500 hover:border-green-400 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                        <ArrowUp className="h-10 w-10 text-green-500 group-hover:text-white transition-colors" />
                        <span className="text-xs font-black text-green-400 uppercase tracking-widest group-hover:text-white">Higher</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl rotate-[-3deg]">
                <Activity className="h-12 w-12 text-white" />
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Analysis Complete</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">
                    Lab Report Generated
                </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 w-full max-w-[280px]">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Total Score</div>
                <div className="text-5xl font-black text-white italic tracking-tighter tabular-nums mb-4">{score}</div>

                <div className="flex items-center justify-center gap-2 text-yellow-500 bg-yellow-500/10 rounded-full py-2 px-4 border border-yellow-500/20">
                    <Coins className="h-4 w-4" />
                    <span className="font-bold text-sm">+{tokensEarned} Tokens</span>
                </div>
            </div>

            <Button
                onClick={onExit}
                className="w-full max-w-[280px] h-12 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-xs transition-all"
            >
                Back to Lab
            </Button>
        </div>
    );

    return (
        <div className="h-full w-full bg-[#050508]">
            {gameState === 'start' && renderStart()}
            {gameState === 'playing' && renderPlaying()}
            {gameState === 'result' && renderResult()}
        </div>
    );
}
