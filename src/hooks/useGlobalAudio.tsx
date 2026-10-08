import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface AudioState {
  url: string;
  title?: string;
  channelName?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
}

interface GlobalAudioContextType {
  audioState: AudioState | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  play: (url: string, title?: string, channelName?: string, startTime?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  getSavedPosition: (url: string) => number;
  isCurrentAudio: (url: string) => boolean;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | null>(null);

const POSITION_STORAGE_KEY = 'audio_positions';

export function GlobalAudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved positions from localStorage
  const getSavedPositions = useCallback((): Record<string, number> => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  // Save position to localStorage
  const savePosition = useCallback((url: string, time: number) => {
    try {
      const positions = getSavedPositions();
      positions[url] = time;
      // Keep only last 50 positions to prevent localStorage bloat
      const keys = Object.keys(positions);
      if (keys.length > 50) {
        delete positions[keys[0]];
      }
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Error saving audio position:', error);
    }
  }, [getSavedPositions]);

  // Get saved position for a URL
  const getSavedPosition = useCallback((url: string): number => {
    const positions = getSavedPositions();
    return positions[url] || 0;
  }, [getSavedPositions]);

  // Check if this URL is the current playing audio
  const isCurrentAudio = useCallback((url: string): boolean => {
    return audioState?.url === url;
  }, [audioState?.url]);

  // Play audio (new or resume)
  const play = useCallback((url: string, title?: string, channelName?: string, startTime?: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If same audio, just resume
    if (audioState?.url === url) {
      audio.play();
      setAudioState(prev => prev ? { ...prev, isPlaying: true } : null);
      return;
    }

    // Save current position before switching
    if (audioState?.url) {
      savePosition(audioState.url, audio.currentTime);
    }

    // Get saved position or use provided startTime
    const savedPosition = startTime ?? getSavedPosition(url);

    // Set up new audio
    audio.src = url;
    audio.currentTime = savedPosition;
    audio.play().catch(console.error);

    setAudioState({
      url,
      title,
      channelName,
      isPlaying: true,
      currentTime: savedPosition,
      duration: 0,
      playbackSpeed: audioState?.playbackSpeed || 1,
    });

    // Apply saved playback speed
    audio.playbackRate = audioState?.playbackSpeed || 1;
  }, [audioState, getSavedPosition, savePosition]);

  // Pause current audio
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.pause();
    setAudioState(prev => prev ? { ...prev, isPlaying: false } : null);
    
    // Save position on pause
    if (audioState?.url) {
      savePosition(audioState.url, audio.currentTime);
    }
  }, [audioState?.url, savePosition]);

  // Resume current audio
  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioState) return;
    
    audio.play().catch(console.error);
    setAudioState(prev => prev ? { ...prev, isPlaying: true } : null);
  }, [audioState]);

  // Stop and clear audio
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Save position before stopping
    if (audioState?.url) {
      savePosition(audioState.url, audio.currentTime);
    }
    
    audio.pause();
    audio.src = '';
    setAudioState(null);
  }, [audioState?.url, savePosition]);

  // Seek to time
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = time;
    setAudioState(prev => prev ? { ...prev, currentTime: time } : null);
  }, []);

  // Set playback speed
  const setSpeed = useCallback((speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.playbackRate = speed;
    setAudioState(prev => prev ? { ...prev, playbackSpeed: speed } : null);
  }, []);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setAudioState(prev => prev ? { ...prev, currentTime: audio.currentTime } : null);
  }, []);

  // Handle loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setAudioState(prev => prev ? { ...prev, duration: audio.duration } : null);
  }, []);

  // Handle audio ended
  const handleEnded = useCallback(() => {
    if (audioState?.url) {
      // Clear saved position when audio finishes
      const positions = getSavedPositions();
      delete positions[audioState.url];
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
    }
    setAudioState(prev => prev ? { ...prev, isPlaying: false, currentTime: 0 } : null);
  }, [audioState?.url, getSavedPositions]);

  // Auto-save position every 5 seconds while playing
  useEffect(() => {
    if (audioState?.isPlaying && audioState?.url) {
      saveIntervalRef.current = setInterval(() => {
        const audio = audioRef.current;
        if (audio && audioState.url) {
          savePosition(audioState.url, audio.currentTime);
        }
      }, 5000);
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [audioState?.isPlaying, audioState?.url, savePosition]);

  // Save position on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const audio = audioRef.current;
      if (audio && audioState?.url) {
        savePosition(audioState.url, audio.currentTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [audioState?.url, savePosition]);

  return (
    <GlobalAudioContext.Provider value={{
      audioState,
      audioRef,
      play,
      pause,
      resume,
      stop,
      seek,
      setSpeed,
      getSavedPosition,
      isCurrentAudio,
    }}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        style={{ display: 'none' }}
      />
    </GlobalAudioContext.Provider>
  );
}

export function useGlobalAudio() {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  }
  return context;
}
