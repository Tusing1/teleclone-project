import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioLevelResult {
  isSpeaking: boolean;
  audioLevel: number;
}

export function useAudioLevel(stream: MediaStream | null): AudioLevelResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!stream) {
      cleanup();
      setIsSpeaking(false);
      setAudioLevel(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const speakingThreshold = 15; // Adjust sensitivity
      let speakingTimeout: ReturnType<typeof setTimeout> | null = null;

      let lastSample = 0;
      const checkAudioLevel = (now = 0) => {
        if (!analyserRef.current) return;
        if (now - lastSample < 100) { animationFrameRef.current = requestAnimationFrame(checkAudioLevel); return; }
        lastSample = now;

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(average / 128, 1)); // Normalize to 0-1

        if (average > speakingThreshold) {
          setIsSpeaking(true);
          if (speakingTimeout) {
            clearTimeout(speakingTimeout);
          }
          speakingTimeout = setTimeout(() => {
            setIsSpeaking(false);
          }, 300); // Keep speaking state for 300ms after sound stops
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();

      return () => {
        if (speakingTimeout) {
          clearTimeout(speakingTimeout);
        }
        cleanup();
      };
    } catch (error) {
      cleanup();
      console.error('Error setting up audio level detection:', error);
    }
  }, [stream, cleanup]);

  return { isSpeaking, audioLevel };
}
