import React, { useState, useEffect, useRef } from 'react';
import {
    Siren, Clock, Check, X,
    AlertTriangle, Trophy, Play,
    HeartPulse, Skull, Activity,
    Timer, Flame, Stethoscope, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useGameLeaderboard } from '@/hooks/useGameLeaderboard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TriageLevel = 'immediate' | 'urgent' | 'delayed';

const SCENARIOS = [
    {
        id: 's1',
        title: 'Explosion Site',
        patients: [
            {
                id: 'p1',
                desc: 'Unresponsive, open skull fracture, brain matter exposed.',
                vitals: 'Apneic, Pulseless',
                correct: 'delayed' // Expectant/Dead (Black) -> In simple 3-tier, usually "Delayed/Dead" or handled separately. Let's use Red/Yellow/Green simpler model or stick to standard. Let's use standard START triage simplified: Red (Immediate), Yellow (Urgent), Green (Minor), Black (Expectant).
                // Simplified for game: Red (Immediate), Yellow (Urgent), Green (Walking Wounded/Minor)
            },
            {
                id: 'p2',
                desc: 'Partial amputation of leg, active bright red bleeding, distinct pulse.',
                vitals: 'RR 32, HR 120, Cap Refill > 2s',
                correct: 'immediate' // Shock, Bleeding -> Red
            },
            {
                id: 'p3',
                desc: 'Large scalp laceration, walking around asking for help.',
                vitals: 'RR 20, HR 90, Alert',
                correct: 'delayed' // Walking wounded -> Green
            }
        ]
    },
    {
        id: 's2',
        title: 'Highway Pileup',
        patients: [
            {
                id: 'p4',
                desc: 'Complaining of severe abdominal pain, seatbelt sign present.',
                vitals: 'RR 24, HR 110, BP 90/60',
                correct: 'immediate' // Internal bleeding signs -> Red
            },
            {
                id: 'p5',
                desc: 'Deformity to forearm, pulses intact, in significant pain.',
                vitals: 'RR 18, HR 88, BP 130/80',
                correct: 'urgent' // Broken bone, stable -> Yellow
            },
            {
                id: 'p6',
                desc: 'Multiple abrasions to face, dazed but following commands.',
                vitals: 'RR 16, HR 80',
                correct: 'urgent' // Concussion possibility -> Yellow/Green borderline, lets say Urgent to be safe or Green? Forearm fix is Yellow. Dazed = Yellow.
            }
        ]
    }
    // We need a better structure. Single patient flow might be better for mobile.
    // "Patient Arrives" -> User clicks Red/Yellow/Green.
];

const PATIENTS = [
    {
        id: 1,
        scenario: 'Motor Vehicle Accident',
        symptoms: 'Gasping for air, tracheal deviation to left.',
        vitals: 'RR 36, O2 85%, HR 130',
        diagnosis: 'Tension Pneumothorax',
        triage: 'immediate',
        reason: 'Life-threatening airway/breathing compromise requires immediate needle decompression.'
    },
    {
        id: 2,
        scenario: 'ER Walk-in',
        symptoms: 'Twisted ankle playing soccer, cannot bear weight.',
        vitals: 'CSM intact, pedal pulses strong',
        diagnosis: 'Ankle Sprain/Fracture',
        triage: 'delayed', // Green/Non-urgent
        reason: 'Stable, requires x-ray but not life threatening.'
    },
    {
        id: 3,
        scenario: 'Home Accident',
        symptoms: 'Deep laceration to hand, bleeding controlled with pressure.',
        vitals: 'HR 90, BP 120/80',
        diagnosis: 'Laceration',
        triage: 'urgent', // Yellow
        reason: 'Needs suturing/repair but stable vitals, not immediately life threatening.'
    },
    {
        id: 4,
        scenario: 'Restaurant',
        symptoms: 'Sudden inability to speak, facial droop, right arm weakness.',
        vitals: 'Last known well: 30 mins ago',
        diagnosis: 'Acute Stroke',
        triage: 'immediate',
        reason: 'Time-sensitive "Time is Brain", within TPA window.'
    },
    {
        id: 5,
        scenario: 'Clinic',
        symptoms: 'Burning with urination, frequency for 2 days.',
        vitals: 'Afebrile, stable',
        diagnosis: 'UTI',
        triage: 'delayed',
        reason: 'Non-urgent infection.'
    },
    {
        id: 6,
        scenario: 'Construction Site',
        symptoms: 'Fell 20ft, confused, abdominal rigidity.',
        vitals: 'HR 130, BP 80/50',
        diagnosis: 'Internal Hemorrhage',
        triage: 'immediate',
        reason: 'Docs of shock (hypotension/tachycardia) + mechanism of injury = Immediate.'
    }
];

interface TriageMasterProps {
    onExit: () => void;
}

export function TriageMaster({ onExit }: TriageMasterProps) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'result'>('start');
    const [patientIdx, setPatientIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [tokensEarned, setTokensEarned] = useState(0);
    const [streak, setStreak] = useState(0);
    const [timeLeft, setTimeLeft] = useState(10); // 10s per patient
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { earnTokens } = useStudyTokens();
    const { saveScore } = useGameLeaderboard('triage');

    const currentPatient = PATIENTS[patientIdx];

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(10);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    handleTimeOut();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleTimeOut = () => {
        toast.error("Time expired! Patient condition worsened.");
        setStreak(0);
        nextPatient();
    };

    const nextPatient = () => {
        if (patientIdx < PATIENTS.length - 1) {
            setPatientIdx(prev => prev + 1);
            startTimer();
        } else {
            endGame();
        }
    };

    const handleTriage = (level: TriageLevel) => {
        const correct = currentPatient.triage === level;

        if (correct) {
            const timeBonus = timeLeft * 10;
            const streakBonus = streak * 20;
            const pts = 100 + timeBonus + streakBonus;
            setScore(prev => prev + pts);
            setStreak(prev => prev + 1);
            toast.success(`Correct Assignment!`); // removed points to be cleaner
        } else {
            setStreak(0);
            toast.error(`Incorrect. Correct priority: ${currentPatient.triage.toUpperCase()}`);
        }

        nextPatient();
    };

    const endGame = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState('result');
        const earned = score > 1000 ? 10 : 5;
        setTokensEarned(earned);
        if (earned > 0) {
            await earnTokens(earned, 'game', 'Triage Master reward');
        }
        await saveScore(score);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const renderStart = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center shadow-2xl skew-x-[-6deg] relative z-10">
                    <Siren className="h-12 w-12 text-white animate-pulse" />
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Triage Master</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em] max-w-[240px] mx-auto">
                    Sort patients by urgency. Speed is key.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
                <div className="bg-red-500/20 border border-red-500/30 p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-black uppercase text-red-500">Immediate</span>
                    <HeartPulse className="h-4 w-4 text-red-500 mx-auto mt-1" />
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500/30 p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-black uppercase text-yellow-500">Urgent</span>
                    <Activity className="h-4 w-4 text-yellow-500 mx-auto mt-1" />
                </div>
                <div className="bg-green-500/20 border border-green-500/30 p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-black uppercase text-green-500">Delayed</span>
                    <Stethoscope className="h-4 w-4 text-green-500 mx-auto mt-1" />
                </div>
            </div>

            <Button
                onClick={() => {
                    setScore(0);
                    setPatientIdx(0);
                    setStreak(0);
                    setGameState('playing');
                    startTimer();
                }}
                className="w-full max-w-[280px] h-14 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Start Shift
            </Button>
        </div>
    );

    const renderPlaying = () => (
        <div className="flex flex-col h-full animate-in fade-in duration-500 pt-6">
            <div className="px-6 mb-6 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Incoming</span>
                    <span className="text-xl font-black text-white italic">#{patientIdx + 1}</span>
                </div>

                <div className="flex items-center gap-2">
                    <Timer className={cn("h-4 w-4", timeLeft <= 3 ? "text-red-500 animate-pulse" : "text-white/50")} />
                    <span className={cn("text-2xl font-black italic tabular-nums", timeLeft <= 3 ? "text-red-500" : "text-white")}>
                        {timeLeft}
                    </span>
                </div>

                <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Score</span>
                    <span className="text-xl font-black text-white tabular-nums">{score}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col justify-center">
                <div className="relative mb-8 w-full max-w-[400px] mx-auto">
                    {/* Monitor Frame */}
                    <div className="absolute inset-0 bg-white/[0.02] border border-white/10 rounded-3xl transform rotate-1 scale-105" />
                    <div className="relative bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">

                        <div className="flex items-start justify-between mb-4 border-b border-white/10 pb-4">
                            <div>
                                <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Scenario</div>
                                <div className="text-sm font-bold text-white">{currentPatient.scenario}</div>
                            </div>
                            <Activity className="h-5 w-5 text-emerald-500 animate-pulse" />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Presentation</div>
                                <div className="text-lg font-black text-white italic leading-tight">{currentPatient.symptoms}</div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">Vitals</div>
                                <div className="text-sm font-mono text-emerald-300 tracking-tight">{currentPatient.vitals}</div>
                            </div>

                            <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                                <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Suspected</div>
                                <div className="text-sm font-bold text-white tracking-tight">{currentPatient.diagnosis}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Triage Buttons */}
                <div className="grid grid-cols-1 gap-3 max-w-[400px] mx-auto w-full">
                    <button
                        onClick={() => handleTriage('immediate')}
                        className="h-16 rounded-2xl bg-gradient-to-r from-red-600/20 to-red-600/10 border border-red-600/50 hover:bg-red-600 hover:border-red-500 hover:text-white group transition-all flex items-center px-6 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <HeartPulse className="h-6 w-6 text-red-500 group-hover:text-white mr-4 relative z-10" />
                        <div className="text-left relative z-10">
                            <div className="text-xs font-black text-red-500 uppercase tracking-widest group-hover:text-white">Red</div>
                            <div className="text-lg font-black text-red-100 italic group-hover:text-white">IMMEDIATE</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleTriage('urgent')}
                        className="h-16 rounded-2xl bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 border border-yellow-500/50 hover:bg-yellow-500 hover:border-yellow-400 hover:text-black group transition-all flex items-center px-6 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-yellow-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Activity className="h-6 w-6 text-yellow-500 group-hover:text-black mr-4 relative z-10" />
                        <div className="text-left relative z-10">
                            <div className="text-xs font-black text-yellow-500 uppercase tracking-widest group-hover:text-black/60">Yellow</div>
                            <div className="text-lg font-black text-yellow-100 italic group-hover:text-black">URGENT</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleTriage('delayed')}
                        className="h-16 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/50 hover:bg-emerald-500 hover:border-emerald-400 hover:text-white group transition-all flex items-center px-6 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Stethoscope className="h-6 w-6 text-emerald-500 group-hover:text-white mr-4 relative z-10" />
                        <div className="text-left relative z-10">
                            <div className="text-xs font-black text-emerald-500 uppercase tracking-widest group-hover:text-white">Green</div>
                            <div className="text-lg font-black text-emerald-100 italic group-hover:text-white">DELAYED</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in-95 duration-500 text-center px-4">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-2xl rotate-[-6deg]">
                <Flame className="h-12 w-12 text-white" />
            </div>

            <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">Shift Over</h2>
                <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">
                    Triage Efficiency Report
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
                Back to Station
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
