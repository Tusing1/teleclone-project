import React, { useState, useEffect, useRef } from 'react';
import {
    Stethoscope, FileText, Check, X,
    AlertCircle, Trophy, Play, Search,
    Clock, Coins, Brain, Thermometer,
    Activity, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CASES = [
    {
        id: 'c1',
        title: 'The Weekend Warrior',
        difficulty: 'Intern',
        points: 100,
        patient: {
            age: 24,
            gender: 'Male',
            symptoms: ['Sudden onset fever', 'Severe headache', 'Stiff neck', 'Photophobia'],
            vitals: { temp: '39.4°C', hr: '110 bpm', bp: '115/75' }
        },
        options: ['Migraine', 'Meningitis', 'Influenza', 'Tension Headache'],
        correct: 'Meningitis',
        explanation: 'The classic triad of fever, nuchal rigidity (stiff neck), and altered mental status (or headache/photophobia) strongly suggests Meningitis.'
    },
    {
        id: 'c2',
        title: 'The Midnight Snack',
        difficulty: 'Resident',
        points: 200,
        patient: {
            age: 55,
            gender: 'Female',
            symptoms: ['Right upper quadrant pain', 'Nausea after fatty meal', 'Fever', 'Jaundice'],
            vitals: { temp: '38.1°C', hr: '92 bpm', bp: '135/85' }
        },
        options: ['Gastritis', 'Acute Cholecystitis', 'Appendicitis', 'Pancreatitis'],
        correct: 'Acute Cholecystitis',
        explanation: 'RUQ pain, especially after a fatty meal, combined with fever and Murphy\'s sign (implied) points to Acute Cholecystitis.'
    },
    {
        id: 'c3',
        title: 'Breathless in Seattle',
        difficulty: 'Attending',
        points: 300,
        patient: {
            age: 68,
            gender: 'Male',
            symptoms: ['Progressive dyspnea', 'Pleuritic chest pain', 'Calf swelling', 'Tachycardia'],
            vitals: { temp: '37.0°C', hr: '118 bpm', bp: '120/80', o2: '90%' }
        },
        options: ['Myocardial Infarction', 'Pneumonia', 'Pulmonary Embolism', 'COPD Exacerbation'],
        correct: 'Pulmonary Embolism',
        explanation: 'The combination of dyspnea, pleuritic chest pain, tachycardia, and unilateral calf swelling (DVT sign) is classic for Pulmonary Embolism.'
    },
    {
        id: 'c4',
        title: 'Sweet Confusion',
        difficulty: 'Specialist',
        points: 400,
        patient: {
            age: 19,
            gender: 'Female',
            symptoms: ['Polyuria', 'Polydipsia', 'Abdominal pain', 'Fruity breath odor'],
            vitals: { temp: '36.8°C', hr: '105 bpm', bp: '100/60', rr: '24 (Deep)' }
        },
        options: ['Diabetes Insipidus', 'Diabetic Ketoacidosis (DKA)', 'Gastroenteritis', 'Hyperosmolar Hyperglycemic State (HHS)'],
        correct: 'Diabetic Ketoacidosis (DKA)',
        explanation: 'Polyuria, polydipsia, "fruity" breath (acetone), and Kussmaul respirations in a young patient strongly indicate Diabetic Ketoacidosis (DKA).'
    }
];

interface ClinicalCaseCrackerProps {
    onExit: () => void;
}

export function ClinicalCaseCracker({ onExit }: ClinicalCaseCrackerProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [currentCaseIdx, setCurrentCaseIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [tokensEarned, setTokensEarned] = useState(0);
    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('clinical');

    const currentCase = CASES[currentCaseIdx];

    const handleOptionSelect = (option: string) => {
        if (selectedOption || isCorrect !== null) return;

        setSelectedOption(option);
        const correct = option === currentCase.correct;
        setIsCorrect(correct);

        if (correct) {
            setScore(prev => prev + currentCase.points);
            toast.success(`Diagnosis Confirmed! +${currentCase.points} pts`);
        } else {
            toast.error(`Incorrect Diagnosis. Correct: ${currentCase.correct}`);
        }

        setTimeout(() => {
            if (currentCaseIdx < CASES.length - 1) {
                setCurrentCaseIdx(prev => prev + 1);
                setSelectedOption(null);
                setIsCorrect(null);
            } else {
                endGame(score + (correct ? currentCase.points : 0));
            }
        }, 3000); // Give time to read explanation if implemented or just see result
    };

    const endGame = async (finalScore: number) => {
        setGameState('result');
        const earned = finalScore >= 500 ? 10 : 5; // Simple reward logic
        setTokensEarned(earned);
        if (earned > 0) {
            await earnTokens(earned, 'game', 'Clinical Case reward');
        }
        await saveScore(finalScore);
    };

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl rotate-[-6deg]">
                <Search className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Case Cracker</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Diagnose complex patient scenarios.
                </p>
            </div>

            <Button
                onClick={() => {
                    setScore(0);
                    setCurrentCaseIdx(0);
                    setGameState('playing');
                }}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Open Case Files
            </Button>
        </div>
    );

    const renderPlaying = () => (
        <div className="flex flex-col h-full animate-in fade-in duration-500 pt-6">
            {/* Header / Score */}
            <div className="px-6 mb-6 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Case File</span>
                    <span className="text-xl font-black text-white italic">#{currentCaseIdx + 1}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/50 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                    {currentCase.difficulty}
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Score</span>
                    <span className="text-xl font-black text-white tabular-nums">{score}</span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6">
                <div className="max-w-md mx-auto space-y-6">
                    {/* Patient Card */}
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <User className="h-24 w-24 text-white" />
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-white/10">
                                    <AvatarFallback className="bg-white/10 text-white font-bold">
                                        {currentCase.patient.gender === 'Male' ? 'M' : 'F'}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-black text-white">{currentCase.title}</h3>
                                    <p className="text-xs text-white/50 font-medium">
                                        {currentCase.patient.age}yo {currentCase.patient.gender}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-white/40">
                                        <Activity className="h-3 w-3" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Vitals</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(currentCase.patient.vitals).map(([key, value]) => (
                                            <div key={key} className="bg-black/20 rounded-lg p-2 border border-white/5">
                                                <span className="text-[8px] text-white/30 uppercase block">{key}</span>
                                                <span className="text-sm font-mono text-emerald-400">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-white/40">
                                        <FileText className="h-3 w-3" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Symptoms</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {currentCase.patient.symptoms.map((symptom, i) => (
                                            <span key={i} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-medium">
                                                {symptom}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 gap-3">
                        {currentCase.options.map((option, i) => {
                            let stateClasses = "bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.08]";
                            if (selectedOption) {
                                if (option === currentCase.correct) {
                                    stateClasses = "bg-green-500/20 border-green-500 text-white";
                                } else if (option === selectedOption) {
                                    stateClasses = "bg-red-500/20 border-red-500 text-white";
                                } else {
                                    stateClasses = "opacity-30 bg-white/[0.01] border-white/5";
                                }
                            }

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleOptionSelect(option)}
                                    disabled={selectedOption !== null}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all text-left flex items-center justify-between group",
                                        stateClasses
                                    )}
                                >
                                    <span className="font-bold text-sm tracking-tight">{option}</span>
                                    {selectedOption && option === currentCase.correct && (
                                        <Check className="h-4 w-4 text-green-400" />
                                    )}
                                    {selectedOption && option === selectedOption && option !== currentCase.correct && (
                                        <X className="h-4 w-4 text-red-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation Reveal */}
                    {selectedOption && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-4 w-4 text-blue-400" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Clinical Note</span>
                            </div>
                            <p className="text-sm text-white/80 leading-relaxed">
                                {currentCase.explanation}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl rotate-[6deg]">
                <Trophy className="h-12 w-12 text-white" />
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Diagnostic Complete</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">
                    Rotation Complete
                </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 w-full max-w-[280px]">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Final Score</div>
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
