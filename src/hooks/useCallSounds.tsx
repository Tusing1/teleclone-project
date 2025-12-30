import { useRef, useCallback } from 'react';

export function useCallSounds() {
    const audioContextRef = useRef<AudioContext | null>(null);

    const initCtx = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    // Modern pleasant ringtone
    const playRingtone = useCallback(() => {
        const ctx = initCtx();
        const startTime = ctx.currentTime;

        // Create a loop
        const playRound = (time: number) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';

            // Melody: E5, G5, E5, C5
            osc1.frequency.setValueAtTime(659.25, time); // E5
            osc1.frequency.setValueAtTime(783.99, time + 0.2); // G5
            osc1.frequency.setValueAtTime(659.25, time + 0.4); // E5
            osc1.frequency.setValueAtTime(523.25, time + 0.6); // C5

            osc2.frequency.setValueAtTime(329.63, time); // E4 harmony
            osc2.frequency.setValueAtTime(392.00, time + 0.2);
            osc2.frequency.setValueAtTime(329.63, time + 0.4);
            osc2.frequency.setValueAtTime(261.63, time + 0.6);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(time);
            osc2.start(time);
            osc1.stop(time + 0.8);
            osc2.stop(time + 0.8);
        };

        // Play twice with a gap
        playRound(startTime);
        playRound(startTime + 1.2);

        return () => {
            // Cleanup would happen here if we used a more complex loop
        };
    }, []);

    // Simple "Join" blip
    const playJoinTone = useCallback(() => {
        const ctx = initCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(now + 0.2);
    }, []);

    // Soft "End" tone
    const playEndTone = useCallback(() => {
        const ctx = initCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.3);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(now + 0.4);
    }, []);

    return { playRingtone, playJoinTone, playEndTone };
}
