import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useFileCache } from '@/hooks/useFileCache';

interface AudioPlayerProps {
  url: string;
  fileName?: string;
  fileSize?: number;
  className?: string;
  variant?: 'default' | 'compact';
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

export function AudioPlayer({ url, fileName, fileSize, className, variant = 'default' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const { isFileCached, getCachedFile, downloadAndCache, saveOffline } = useFileCache();

  // Check cache and load audio
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    const loadAudio = async () => {
      setIsLoading(true);
      
      try {
        const cached = await isFileCached(url);
        setIsCached(cached);
        
        if (cached) {
          const cachedFile = await getCachedFile(url);
          if (cachedFile) {
            if (disposed) return;
            objectUrl = URL.createObjectURL(cachedFile.blob);
            setAudioUrl(objectUrl);
            setIsLoading(false);
            return;
          }
        }
        
        // Not cached, use original URL
        setAudioUrl(url);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading audio:', error);
        setAudioUrl(url);
        setIsLoading(false);
      }
    };
    
    loadAudio();
    
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  // Cache audio on first play if not cached
  const handlePlay = async () => {
    if (!audioRef.current) return;
    
    if (!isCached && audioUrl) {
      // Cache in background
      downloadAndCache(url, fileName || 'audio.webm').then(blob => {
        if (blob) setIsCached(true);
      });
    }
    
    try { await audioRef.current.play(); setIsPlaying(true); }
    catch { toast.error('Could not play this audio. Try saving it offline.'); }
  };

  const handlePause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const cyclePlaybackSpeed = () => {
    if (!audioRef.current) return;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    audioRef.current.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    setCurrentTime(audioRef.current.currentTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    setCurrentTime(audioRef.current.currentTime);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    try { await saveOffline(url, fileName || 'audio.webm'); setIsCached(true); toast.success('Saved offline in StudyGram'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save offline'); }
  };

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center p-4 rounded-lg bg-muted/50',
        className
      )}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-col gap-2 p-2 rounded-lg bg-muted/50', className)}>
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        )}
        
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={skipBackward}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-primary-foreground" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4 text-primary-foreground ml-0.5" fill="currentColor" />
            )}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={skipForward}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          
          <div className="flex-1 space-y-0.5">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-xs font-medium"
            onClick={cyclePlaybackSpeed}
          >
            {playbackSpeed}x
          </Button>
          
          {isCached && (
            <span className="text-[10px] text-emerald-500">●</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border',
      className
    )}>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}
      
      {/* Header with file info */}
      {fileName && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{fileName}</span>
            {isCached && (
              <span className="text-[10px] text-emerald-500 px-1.5 py-0.5 bg-emerald-500/10 rounded">
                Cached
              </span>
            )}
          </div>
          {fileSize && (
            <span className="text-xs text-muted-foreground shrink-0">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
      )}
      
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={skipBackward}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shrink-0"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          ) : (
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" />
          )}
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={skipForward}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      
      {/* Volume, speed and download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs font-medium"
            onClick={cyclePlaybackSpeed}
          >
            {playbackSpeed}x
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="w-20 cursor-pointer"
          />
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Save audio offline"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
