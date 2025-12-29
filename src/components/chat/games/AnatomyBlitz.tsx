import { useState, useEffect, useRef } from 'react';
import {
    Zap, Brain, RefreshCw, Check,
    AlertCircle, Trophy, Play, ArrowRight,
    Clock, Coins, Star, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ANATOMY_LEVELS = [
    {
        id: 'novice',
        name: 'Novice',
        color: 'from-blue-500 to-indigo-600',
        timer: 10,
        questions: [
            { q: 'Which organ is responsible for pumping blood?', options: ['Lungs', 'Brain', 'Heart', 'Stomach'], correct: 'Heart' },
            { q: 'Where are the frontal lobes located?', options: ['Heart', 'Brain', 'Lungs', 'Liver'], correct: 'Brain' },
            { q: 'Which organ filters waste from the blood?', options: ['Spleen', 'Kidneys', 'Pancreas', 'Gallbladder'], correct: 'Kidneys' },
            { q: 'Which part of the body contains the femur?', options: ['Arm', 'Leg', 'Torso', 'Head'], correct: 'Leg' }
        ]
    },
    {
        id: 'intern',
        name: 'Intern',
        color: 'from-emerald-500 to-teal-600',
        timer: 8,
        questions: [
            { q: 'Where is the mitral valve located?', options: ['Lungs', 'Heart', 'Brain', 'Kidneys'], correct: 'Heart' },
            { q: 'What is the largest bone in the human body?', options: ['Tibia', 'Femur', 'Humerus', 'Pelvis'], correct: 'Femur' },
            { q: 'Which gland regulates metabolism?', options: ['Pituitary', 'Thyroid', 'Adrenal', 'Pancreas'], correct: 'Thyroid' },
            { q: 'Where do you find alveoli?', options: ['Intestines', 'Lungs', 'Stomach', 'Mouth'], correct: 'Lungs' }
        ]
    },
    {
        id: 'specialist',
        name: 'Specialist',
        color: 'from-orange-500 to-rose-600',
        timer: 6,
        questions: [
            { q: 'What is the functional unit of the kidney?', options: ['Neuron', 'Nephron', 'Axon', 'Glomerulus'], correct: 'Nephron' },
            { q: 'Which part of the brain controls balance?', options: ['Cerebrum', 'Cerebellum', 'Thalamus', 'Medulla'], correct: 'Cerebellum' },
            { q: 'Where is the Islets of Langerhans?', options: ['Liver', 'Pancreas', 'Spleen', 'Adrenal'], correct: 'Pancreas' },
            { q: 'What covers the axon of a neuron?', options: ['Dendrite', 'Myelin Sheath', 'Synapse', 'Cortex'], correct: 'Myelin Sheath' }
        ]
    }
];

interface AnatomyBlitzProps {
    onExit: () => void;
}

export function AnatomyBlitz({ onExit }: AnatomyBlitzProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [levelIdx, setLevelIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [score, setScore] = useState(0);
    const [tokensEarned, setTokensEarned] = useState(0);
    const [timeLeft, setTimeLeft] = useState(10);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showCorrection, setShowCorrection] = useState(false);

    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('anatomy-blitz');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentLevel = ANATOMY_LEVELS[levelIdx];

    const startNewRound = (roundIdx: number, lIdx: number = levelIdx) => {
        if (roundIdx >= 3) {
            if (lIdx < ANATOMY_LEVELS.length - 1) {
                setLevelIdx(lIdx + 1);
                setCurrentRound(0);
                setTimeout(() => startNewRound(0, lIdx + 1), 100);
                return;
            } else {
                endGame();
                return;
            }
        }

        const levelQuestions = ANATOMY_LEVELS[lIdx].questions;
        const nextQ = levelQuestions[Math.floor(Math.random() * levelQuestions.length)];
        setCurrentQuestion(nextQ);
        setCurrentRound(roundIdx);
        setSelectedOption(null);
        setShowCorrection(false);
        setTimeLeft(ANATOMY_LEVELS[lIdx].timer);
        setGameState('playing');
    };

    const handleAnswer = (option: string) => {
        if (selectedOption || showCorrection) return;

        setSelectedOption(option);
        const isCorrect = option === currentQuestion.correct;

        if (isCorrect) {
            const roundPoints = 150 + (timeLeft * 15) + (levelIdx * 75);
            setScore(prev => prev + roundPoints);
            toast.success(`Correct! +${roundPoints} points`);
            setTimeout(() => startNewRound(currentRound + 1), 1000);
        } else {
            setShowCorrection(true);
            toast.error('Incorrect identification!');
            setTimeout(() => startNewRound(currentRound + 1), 1500);
        }
    };

    const endGame = async () => {
        setGameState('result');
        if (timerRef.current) clearInterval(timerRef.current);

        const earned = score > 800 ? 5 : 0;
        setTokensEarned(earned);

        if (earned > 0) {
            await earnTokens(earned, 'game', 'Anatomy Blitz reward');
        }
        await saveScore(score);
    };

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0 && !selectedOption) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setShowCorrection(true);
                        setTimeout(() => startNewRound(currentRound + 1), 1500);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentRound, levelIdx, selectedOption]);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-[6deg]">
                <Activity className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Anatomy Blitz</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Identify parts of the human body at high speed!
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-[320px]">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Clock className="h-4 w-4 text-emerald-400 mb-2" />
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Blitz Speed</span>
                    <span className="text-sm font-black text-white">6-10s / Q</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left">
                    <Zap className="h-4 w-4 text-yellow-500 mb-2" />
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
                Initialize Scan
            </Button>
        </div>
    );

    const renderPlaying = () => {
        if (!currentQuestion) return null;

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

                <div className="flex justify-between items-center px-4 mb-12">
                    <div className="space-y-0.5 text-left text-xs italic tracking-tighter">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block not-italic">Phase</span>
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
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Vital Score</span>
                        <span className="text-xl font-black text-white tabular-nums italic tracking-tighter">
                            {score}
                        </span>
                    </div>
                    <div className="text-right items-end flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block text-right">Blitz Timer</span>
                        <span className={cn(
                            "text-2xl font-black italic tracking-tighter tabular-nums text-right inline-block min-w-[45px]",
                            timeLeft <= 3 ? "text-red-500 animate-pulse" : "text-white"
                        )}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start text-center px-4">
                    <div className="relative mb-10 w-full">
                        <div className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 h-32 blur-[80px] rounded-full opacity-20", currentLevel.color)} />
                        <div className="relative p-6 md:p-10 rounded-[40px] bg-white/[0.03] border border-white/[0.1] backdrop-blur-3xl shadow-2xl overflow-hidden group min-h-[160px] flex flex-col justify-center">
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-1000", currentLevel.color.split(' ')[1])}
                                    style={{ width: `${(timeLeft / currentLevel.timer) * 100}%` }}
                                />
                            </div>
                            <span className="block text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-4">Identify</span>
                            <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white uppercase leading-snug">
                                {currentQuestion.q}
                            </h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 w-full max-w-[360px]">
                        {currentQuestion.options.map((option: string) => {
                            const isSelected = selectedOption === option;
                            const isCorrect = option === currentQuestion.correct;
                            const showAsCorrect = showCorrection && isCorrect;
                            const showAsIncorrect = selectedOption === option && !isCorrect;

                            return (
                                <button
                                    key={option}
                                    disabled={!!selectedOption || showCorrection}
                                    onClick={() => handleAnswer(option)}
                                    className={cn(
                                        "h-14 md:h-16 rounded-[24px] border px-6 flex items-center justify-between transition-all duration-300 group",
                                        !selectedOption && !showCorrection && "bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-white/20 active:scale-95",
                                        isSelected && isCorrect && "bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/10",
                                        showAsIncorrect && "bg-red-500/20 border-red-500 shake",
                                        showAsCorrect && !isSelected && "bg-emerald-500/10 border-emerald-500/50"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-black uppercase tracking-widest",
                                        isSelected || showAsCorrect ? "text-white" : "text-white/60"
                                    )}>
                                        {option}
                                    </span>
                                    {isSelected && isCorrect && <Check className="h-5 w-5 text-emerald-500" />}
                                    {showAsIncorrect && <AlertCircle className="h-5 w-5 text-red-500" />}
                                    {showAsCorrect && !isSelected && <Check className="h-4 w-4 text-emerald-500/50" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center shadow-2xl relative z-10 transform rotate-[-8deg]">
                    <Trophy className="h-12 w-12 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Scan Complete</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
                    Final Vital Score: {score}
                </p>
            </div>

            <div className="w-full max-w-[300px] p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
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
                    Restart Scan
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
