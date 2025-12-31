import React, { useState, useEffect, useRef } from 'react';
import {
    Zap, Pill, RefreshCw, Check,
    AlertCircle, Trophy, Play, ArrowRight,
    Clock, Coins, Star, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PHARMA_DATA = [
    {
        id: 'novice',
        name: 'Novice',
        color: 'from-blue-500 to-cyan-500',
        timer: 15,
        pairs: [
            { drug: 'Metformin', class: 'Biguanide (Antidiabetic)' },
            { drug: 'Lisinopril', class: 'ACE Inhibitor' },
            { drug: 'Atorvastatin', class: 'HMG-CoA Reductase Inhibitor (Statin)' },
            { drug: 'Amlodipine', class: 'Calcium Channel Blocker' },
            { drug: 'Albuterol', class: 'Beta-2 Agonist (Bronchodilator)' },
            { drug: 'Omeprazole', class: 'Proton Pump Inhibitor (PPI)' },
            { drug: 'Levothyroxine', class: 'Thyroid Hormone Replacement' },
            { drug: 'Warfarin', class: 'Anticoagulant' }
        ]
    },
    {
        id: 'intern',
        name: 'Intern',
        color: 'from-purple-500 to-pink-500',
        timer: 12,
        pairs: [
            { drug: 'Furosemide', class: 'Loop Diuretic' },
            { drug: 'Metoprolol', class: 'Beta-1 Selective Blocker' },
            { drug: 'Gabapentin', class: 'Anticonvulsant / Neuropathic' },
            { drug: 'Sertraline', class: 'SSRI (Antidepressant)' },
            { drug: 'Prednisone', class: 'Corticosteroid' },
            { drug: 'Amoxicillin', class: 'Penicillin Antibiotic' },
            { drug: 'Azithromycin', class: 'Macrolide Antibiotic' },
            { drug: 'Fluoxetine', class: 'SSRI (Antidepressant)' }
        ]
    },
    {
        id: 'specialist',
        name: 'Specialist',
        color: 'from-orange-500 to-rose-600',
        timer: 8,
        pairs: [
            { drug: 'Digoxin', class: 'Cardiac Glycoside' },
            { drug: 'Spironolactone', class: 'Potassium-Sparing Diuretic' },
            { drug: 'Vancomycin', class: 'Glycopeptide Antibiotic' },
            { drug: 'Rivaroxaban', class: 'Factor Xa Inhibitor' },
            { drug: 'Quetiapine', class: 'Atypical Antipsychotic' },
            { drug: 'Sumatriptan', class: 'Triptan (Migraine Therapy)' },
            { drug: 'Phenytoin', class: 'Hydantoin Anticonvulsant' },
            { drug: 'Propofol', class: 'Intravenous Anesthetic' }
        ]
    }
];

interface PharmMatchProps {
    onExit: () => void;
}

export function PharmMatch({ onExit }: PharmMatchProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [levelIdx, setLevelIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [currentPair, setCurrentPair] = useState<{ drug: string, class: string } | null>(null);
    const [options, setOptions] = useState<string[]>([]);
    const [score, setScore] = useState(0);
    const [tokensEarned, setTokensEarned] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('pharm-match');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentLevel = PHARMA_DATA[levelIdx];

    const generateOptions = (correctClass: string) => {
        const allPossibleClasses = PHARMA_DATA.flatMap(l => l.pairs.map(p => p.class));
        const uniqueClasses = Array.from(new Set(allPossibleClasses)).filter(c => c !== correctClass);
        const shuffled = uniqueClasses.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);
        selected.push(correctClass);
        return selected.sort(() => Math.random() - 0.5);
    };

    const startNewRound = (roundIdx: number, lIdx: number = levelIdx) => {
        if (roundIdx >= 4) { // 4 drugs per level
            if (lIdx < PHARMA_DATA.length - 1) {
                setLevelIdx(lIdx + 1);
                setCurrentRound(0);
                setTimeout(() => startNewRound(0, lIdx + 1), 100);
                return;
            } else {
                endGame();
                return;
            }
        }

        const levelPairs = PHARMA_DATA[lIdx].pairs;
        const nextPair = levelPairs[Math.floor(Math.random() * levelPairs.length)];
        setCurrentPair(nextPair);
        setOptions(generateOptions(nextPair.class));
        setCurrentRound(roundIdx);
        setIsCorrect(null);
        setSelectedOption(null);
        setTimeLeft(PHARMA_DATA[lIdx].timer);
        setGameState('playing');
    };

    const handleOptionSelect = (option: string) => {
        if (selectedOption || isCorrect !== null) return;

        setSelectedOption(option);
        if (option === currentPair?.class) {
            setIsCorrect(true);
            const roundPoints = 150 + (timeLeft * 15) + (levelIdx * 75);
            setScore(prev => prev + roundPoints);
            toast.success(`Correct! +${roundPoints} points`);
            setTimeout(() => startNewRound(currentRound + 1), 1000);
        } else {
            setIsCorrect(false);
            toast.error(`Incorrect. The correct class was: ${currentPair?.class}`);
            setTimeout(() => startNewRound(currentRound + 1), 2000);
        }
    };

    const endGame = async () => {
        setGameState('result');
        if (timerRef.current) clearInterval(timerRef.current);

        const earned = score > 1000 ? 5 : 0;
        setTokensEarned(earned);

        if (earned > 0) {
            await earnTokens(earned, 'game', 'PharmMatch reward');
        }

        await saveScore(score);
    };

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0 && isCorrect === null) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setIsCorrect(false);
                        toast.error(`Time's up! Correct class: ${currentPair?.class}`);
                        setTimeout(() => startNewRound(currentRound + 1), 2000);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentRound, levelIdx, isCorrect]);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-[-6deg]">
                <Pill className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">PharmMatch</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Master the mechanisms of common medications!
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-[320px]">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Type</span>
                    <span className="text-sm font-black text-white">Mechanism Match</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Trophy className="h-4 w-4 text-teal-400 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Reward</span>
                    <span className="text-sm font-black text-white">5 Tokens</span>
                </div>
            </div>

            <Button
                onClick={() => {
                    setLevelIdx(0);
                    setScore(0);
                    startNewRound(0, 0);
                }}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Initialize Study
            </Button>
        </div>
    );

    const renderPlaying = () => {
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
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Batch Progress</span>
                        <div className="flex gap-1">
                            {[0, 1, 2, 3].map(idx => (
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
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Score</span>
                        <span className="text-xl font-black text-white tabular-nums italic tracking-tighter">
                            {score}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Remaining</span>
                        <span className={cn(
                            "text-2xl font-black italic tracking-tighter tabular-nums inline-block min-w-[40px]",
                            timeLeft <= 3 ? "text-red-500 animate-pulse" : "text-white"
                        )}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start text-center px-4">
                    <div className="relative mb-12 w-full max-w-[400px]">
                        <div className={cn("absolute inset-0 blur-3xl rounded-full opacity-20", currentLevel.color)} />
                        <div className="relative p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.1] backdrop-blur-3xl shadow-2xl">
                            <span className="block text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-4">Medication Name</span>
                            <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">
                                {currentPair?.drug}
                            </h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[500px]">
                        {options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleOptionSelect(option)}
                                disabled={selectedOption !== null}
                                className={cn(
                                    "p-5 rounded-[24px] border-2 transition-all text-left group relative overflow-hidden",
                                    selectedOption === option
                                        ? (option === currentPair?.class ? "bg-green-500/20 border-green-500 text-white" : "bg-red-500/20 border-red-500 text-white")
                                        : (isCorrect !== null && option === currentPair?.class ? "bg-green-500/20 border-green-500" : "bg-white/[0.02] border-white/10 hover:border-white/30 text-white/70 hover:text-white")
                                )}
                            >
                                <span className="block text-[8px] font-black opacity-30 uppercase tracking-widest mb-1">Option {idx + 1}</span>
                                <span className="font-bold text-sm tracking-tight">{option}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-yellow-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl relative z-10 transform rotate-[8deg]">
                    <Trophy className="h-12 w-12 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Lab Concluded</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
                    Final Mastery Level: {score}
                </p>
            </div>

            <div className="w-full max-w-[300px] p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50" />
                <span className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4 relative z-10">Tokens Rewarded</span>
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
                    Back to Hub
                </Button>
                <Button
                    onClick={() => {
                        setScore(0);
                        setLevelIdx(0);
                        startNewRound(0, 0);
                    }}
                    className="h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                    Retry Experiment
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
