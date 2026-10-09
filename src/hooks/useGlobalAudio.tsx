import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useFileCache } from './useFileCache';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AudioSource { conversationId: string; messageId?: string; label?: string }

interface AudioState {
  url: string;
  title?: string;
  channelName?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  source?: AudioSource;
}

interface GlobalAudioContextType {
  audioState: AudioState | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  play: (url: string, title?: string, channelName?: string, startTime?: number, source?: AudioSource) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  getSavedPosition: (url: string) => number;
  isCurrentAudio: (url: string) => boolean;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | null>(null);


export function GlobalAudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const POSITION_STORAGE_KEY = `studygram-audio-positions:${user?.id || 'signed-out'}`;
  const { getCachedFile } = useFileCache();
  const ownedUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    generation.current++;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.removeAttribute('src');
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = null; setAudioState(null);
    return () => { generation.current++; audioRef.current?.pause(); if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current); ownedUrl.current = null; };
  }, [user?.id]);

  // Load saved positions from localStorage
  const getSavedPositions = useCallback((): Record<string, number> => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [POSITION_STORAGE_KEY]);

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
  }, [getSavedPositions, POSITION_STORAGE_KEY]);

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
  const play = useCallback(async (url: string, title?: string, channelName?: string, startTime?: number, source?: AudioSource) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If same audio, just resume
    if (audioState?.url === url) {
      if (source) setAudioState(previous => previous ? { ...previous, source, title: title || previous.title, channelName: channelName || previous.channelName } : null);
      if (startTime !== undefined) audio.currentTime = startTime;
      try { await audio.play(); } catch { toast.error('Audio could not play. Tap play to retry.'); }
      return;
    }

    // Save current position before switching
    if (audioState?.url) {
      savePosition(audioState.url, audio.currentTime);
    }

    // Get saved position or use provided startTime
    const savedPosition = startTime ?? getSavedPosition(url);

    // Set up new audio
    const ticket = ++generation.current;
    audio.pause();
    const cached = await getCachedFile(url);
    if (ticket !== generation.current) return;
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = cached ? URL.createObjectURL(cached.blob) : null;
    audio.src = ownedUrl.current || url;
    pendingSeek.current = savedPosition;

    setAudioState({
      url,
      title,
      channelName,
      isPlaying: false,
      currentTime: savedPosition,
      duration: 0,
      playbackSpeed: audioState?.playbackSpeed || 1,
      source,
    });

    // Apply saved playback speed
    audio.playbackRate = audioState?.playbackSpeed || 1;
    try { await audio.play(); } catch { if (ticket === generation.current) toast.error('Audio could not play. Tap play to retry.'); }
  }, [audioState, getSavedPosition, savePosition, getCachedFile]);

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
    
    audio.play().catch(() => toast.error('Audio could not play. Tap play to retry.'));
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
    generation.current++;
    pendingSeek.current = null;
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = null;
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
    if (pendingSeek.current !== null) {
      audio.currentTime = Math.min(pendingSeek.current, Number.isFinite(audio.duration) ? audio.duration : pendingSeek.current);
      pendingSeek.current = null;
    }
    
    setAudioState(prev => prev ? { ...prev, duration: audio.duration } : null);
  }, []);

  // Handle audio ended
  const handleEnded = useCallback(() => {
    if (audioState?.url) {
      // Clear saved position when audio finishes
      const positions = getSavedPositions();
      delete positions[audioState.url];
      try { localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions)); } catch { /* Private browsing may decline position storage. */ }
    }
    setAudioState(prev => prev ? { ...prev, isPlaying: false, currentTime: 0 } : null);
  }, [audioState?.url, getSavedPositions, POSITION_STORAGE_KEY]);

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
        onPlay={() => setAudioState(prev => prev ? { ...prev, isPlaying: true } : null)}
        onPause={() => setAudioState(prev => prev ? { ...prev, isPlaying: false } : null)}
        onError={() => { setAudioState(prev => prev ? { ...prev, isPlaying: false } : null); toast.error('Audio unavailable. Check your connection or saved files.'); }}
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
