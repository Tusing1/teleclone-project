import { useEffect, useRef, useCallback } from 'react';

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Create a simple notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      // Create audio context on demand (required for autoplay policies)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume if suspended (for browsers with strict autoplay policies)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const currentTime = ctx.currentTime;

      // Create oscillators for a pleasant notification sound
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // First tone
      oscillator1.frequency.setValueAtTime(587.33, currentTime); // D5
      oscillator1.frequency.setValueAtTime(783.99, currentTime + 0.1); // G5
      oscillator1.type = 'sine';

      // Second tone (harmony)
      oscillator2.frequency.setValueAtTime(440, currentTime); // A4
      oscillator2.frequency.setValueAtTime(587.33, currentTime + 0.1); // D5
      oscillator2.type = 'sine';

      // Volume envelope
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.2, currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.12);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.3);

      oscillator1.start(currentTime);
      oscillator2.start(currentTime);
      oscillator1.stop(currentTime + 0.3);
      oscillator2.stop(currentTime + 0.3);

    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  useEffect(() => {
    // Listen for service worker messages to play sound
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_RECEIVED' && !['call', 'live_call'].includes(event.data.payload?.data?.type)) {
        playNotificationSound();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [playNotificationSound]);

  return { playNotificationSound };
}
