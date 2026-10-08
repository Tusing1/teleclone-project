import { useRef, useCallback, useEffect } from 'react';

// Quiet synthesized cues: no downloads, autoplay exceptions or leftover ringing nodes.
export function useCallSounds() {
  const context = useRef<AudioContext | null>(null);
  const nodes = useRef(new Set<{ oscillator: OscillatorNode; gain: GainNode; ring: boolean }>());
  const stopRingtone = useCallback(() => {
    for (const node of nodes.current) if (node.ring) {
      try { node.oscillator.stop(); } catch { /* Already finished. */ }
      node.oscillator.disconnect(); node.gain.disconnect(); nodes.current.delete(node);
    }
  }, []);
  const tone = useCallback((notes: number[], ring = false, volume = .045) => {
    try {
      const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      const ctx = context.current && context.current.state !== 'closed' ? context.current : new Audio();
      context.current = ctx;
      const schedule = () => {
      if (context.current !== ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
        const node = { oscillator, gain, ring }; nodes.current.add(node);
        const start = now + index * .16;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + .015);
        gain.gain.exponentialRampToValueAtTime(.001, start + .22);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.current.delete(node); };
        oscillator.start(start); oscillator.stop(start + .24);
      });
      };
      if (ctx.state === 'suspended') { void ctx.resume().then(schedule).catch(() => {}); }
      else schedule();
    } catch { /* Audio feedback must never prevent joining or leaving. */ }
  }, []);
  const playRingtone = useCallback(() => { stopRingtone(); tone([523.25, 659.25, 783.99, 659.25], true, .07); }, [tone, stopRingtone]);
  const playJoinTone = useCallback(() => tone([659.25, 880]), [tone]);
  const playEndTone = useCallback(() => tone([440, 329.63]), [tone]);
  const playControlTone = useCallback(() => tone([740], false, .025), [tone]);
  useEffect(() => () => {
    stopRingtone();
    const oldContext = context.current;
    // Let a short end cue finish, then release this hook's audio device.
    const oldNodes = nodes.current;
    nodes.current = new Set();
    setTimeout(() => {
      for (const node of oldNodes) { try { node.oscillator.stop(); } catch { /* Finished. */ } node.oscillator.disconnect(); node.gain.disconnect(); }
      oldNodes.clear(); void oldContext?.close().catch(() => {});
    }, 450);
    context.current = null;
  }, [stopRingtone]);
  return { playRingtone, stopRingtone, playJoinTone, playEndTone, playControlTone };
}
