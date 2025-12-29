import { useState, useEffect, useRef } from 'react';
import {
    Zap, Brain, RefreshCw, Check,
    AlertCircle, Trophy, Play, ArrowRight,
    Clock, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MEDICAL_TERMS = [
    { term: 'BRADYCARDIA', hint: 'Slow heart rate (under 60 bpm)' },
    { term: 'HEPATITIS', hint: 'Inflammation of the liver' },
    { term: 'NEPHROLOGY', hint: 'Study of kidney function' },
    { term: 'GASTRITIS', hint: 'Inflammation of the stomach lining' },
    { term: 'HYPERTENSION', hint: 'High blood pressure' },
    { term: 'EPINEPHRINE', hint: 'Hormone used in anaphylaxis' },
    { term: 'DYSPEPSIA', hint: 'Indigestion or upset stomach' },
    { term: 'STETHSCOPE', hint: 'Tool to listen to heart/lungs' },
    { term: 'CYTOLOGY', hint: 'The study of cells' },
    { term: 'RHINITIS', hint: 'Irritation/swelling of nasal mucus' }
];

interface MedicalTermScrambleProps {
    onExit: () => void;
}

export function MedicalTermScramble({ onExit }: MedicalTermScrambleProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [currentRound, setCurrentRound] = useState(0);
    const [scrambled, setScrambled] = useState('');
    const [input, setInput] = useState('');
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const { earnTokens } = useStudyTokens();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const scrambleWord = (word: string) => {
        return word.split('').sort(() => Math.random() - 0.5).join('');
    };

    const startNewRound = (roundIdx: number) => {
        if (roundIdx >= 5) {
            endGame();
            return;
        }
        const nextTerm = MEDICAL_TERMS[Math.floor(Math.random() * MEDICAL_TERMS.length)];
        setScrambled(scrambleWord(nextTerm.term));
        setCurrentRound(roundIdx);
        setInput('');
        setIsCorrect(null);
        setTimeLeft(15);
        setGameState('playing');
    };

    const checkAnswer = () => {
        const currentTerm = MEDICAL_TERMS.find(t => scrambleWord(t.term).length === scrambled.length && scrambleWord(t.term).split('').sort().join('') === scrambled.split('').sort().join(''));

        if (input.toUpperCase() === currentTerm?.term) {
            setIsCorrect(true);
            setScore(prev => prev + 10);
            toast.success('Correct! +10 TK potential');
            setTimeout(() => startNewRound(currentRound + 1), 1000);
        } else {
            setIsCorrect(false);
            toast.error('Not quite. Try again!');
        }
    };

    const endGame = async () => {
        setGameState('result');
        if (timerRef.current) clearInterval(timerRef.current);
        if (score > 0) {
            await earnTokens(score, 'game', 'Medical Term Scramble reward');
            toast.success(`You earned ${score} Study Tokens!`);
        }
    };

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        startNewRound(currentRound + 1);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentRound]);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/20 rotate-[-6deg]">
                <Brain className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Term Scramble</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Unscramble medical terms to win study tokens!
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-[320px]">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Clock className="h-4 w-4 text-purple-400 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Time Limit</span>
                    <span className="text-sm font-black text-white">15s / Term</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Trophy className="h-4 w-4 text-pink-500 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Potential</span>
                    <span className="text-sm font-black text-white">50 Tokens</span>
                </div>
            </div>

            <Button
                onClick={() => startNewRound(0)}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Inject Science
            </Button>
        </div>
    );

    const renderPlaying = () => {
        const currentTerm = MEDICAL_TERMS.find(t => {
            // Find the term that matches our scrambled letters
            const sortedScrambled = scrambled.split('').sort().join('');
            const sortedTerm = t.term.split('').sort().join('');
            return sortedScrambled === sortedTerm;
        });

        return (
            <div className="flex flex-col h-full animate-in fade-in duration-500 pt-10">
                <div className="flex justify-between items-center px-4 mb-20">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block font-black line-none">Progress</span>
                        <div className="flex gap-1.5 font-black">
                            {[0, 1, 2, 3, 4].map(idx => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-1.5 w-6 rounded-full transition-all duration-500",
                                        idx < currentRound ? "bg-purple-500" : idx === currentRound ? "bg-white animate-pulse" : "bg-white/10"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block font-black line-none">Time Left</span>
                        <span className={cn(
                            "text-2xl font-black italic tracking-tighter tabular-nums",
                            timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-white"
                        )}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start text-center px-4">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-purple-600/20 blur-3xl rounded-full" />
                        <div className="relative p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.1] backdrop-blur-3xl shadow-2xl">
                            <span className="block text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mb-4">Unscramble</span>
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
                            className="w-full h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl"
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
                    Scientific analysis complete
                </p>
            </div>

            <div className="w-full max-w-[300px] p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50" />
                <span className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4 relative z-10">Tokens Earned</span>
                <div className="flex items-center justify-center gap-3 relative z-10">
                    <Coins className="h-8 w-8 text-yellow-500" />
                    <span className="text-5xl font-black text-white italic tracking-tighter tabular-nums">{score}</span>
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
                        startNewRound(0);
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
