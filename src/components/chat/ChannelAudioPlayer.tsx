import React, { useState, useEffect } from 'react';
import { Play, Pause, Download, MoreVertical, Loader2, RotateCcw, RotateCw, Check, ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFileCache } from '@/hooks/useFileCache';
import { useGlobalAudio, type AudioSource } from '@/hooks/useGlobalAudio';
import { toast } from 'sonner';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

interface ChannelAudioPlayerProps {
  url: string;
  title?: string;
  fileName?: string;
  channelName?: string;
  duration?: number;
  className?: string;
  source?: AudioSource;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

export function ChannelAudioPlayer({ 
  url, 
  title,
  fileName,
  channelName,
  duration: initialDuration,
  className, source
}: ChannelAudioPlayerProps) {
  const { audioState, play, pause, seek, setSpeed, getSavedPosition, isCurrentAudio } = useGlobalAudio();
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const savedOffline = useOfflineStatus(url);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [localDuration, setLocalDuration] = useState(initialDuration || 0);
  
  const { isFileCached, getCachedFile, downloadWithProgress, clearFileCache } = useFileCache();

  // Check if this audio is currently playing
  const isThisAudio = isCurrentAudio(audioUrl || url);
  const isPlaying = isThisAudio && audioState?.isPlaying;
  const currentTime = isThisAudio ? (audioState?.currentTime || 0) : getSavedPosition(audioUrl || url);
  const duration = isThisAudio && audioState?.duration ? audioState.duration : localDuration;
  const playbackSpeed = isThisAudio ? (audioState?.playbackSpeed || 1) : 1;

  // Check cache and load audio
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      
      try {
        const cached = await isFileCached(url);
        setIsCached(cached);
        
        if (cached) {
          const cachedFile = await getCachedFile(url);
          if (cachedFile) {
            setAudioUrl(url);
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
      // The shared provider owns cached playback URLs.
    };
  }, [url]);

  // Load duration from a temporary audio element if not playing
  useEffect(() => {
    if (isThisAudio || !audioUrl || localDuration) return;
    let active = true; let objectUrl: string | undefined; let tempAudio: HTMLAudioElement | undefined;
    void getCachedFile(url).then(cached => {
      if (!active) return;
      // Never request metadata from the network for a downloaded file.
      if (cached) objectUrl = URL.createObjectURL(cached.blob);
      if (!cached && !navigator.onLine) return;
      tempAudio = new Audio(objectUrl || url);
      tempAudio.preload = 'metadata';
      tempAudio.addEventListener('loadedmetadata', () => { if (active && Number.isFinite(tempAudio!.duration)) setLocalDuration(tempAudio!.duration); });
    });
    return () => { active = false; if (tempAudio) tempAudio.src = ''; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [audioUrl, url, isThisAudio, localDuration, getCachedFile]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handleDownload = async () => {
    triggerHaptic();
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      // Save only in StudyGram's app-private offline cache
      if (!isCached) {
        const blob = await downloadWithProgress(url, fileName || `${title || 'audio'}.${url.split('?')[0].split('.').pop() || 'opus'}`, (percent) => {
          setDownloadProgress(percent);
        });
        if (blob) {
          setIsCached(true);
          setAudioUrl(url);
        } else throw new Error('Storage or network unavailable');
      } else {
        const blob = await downloadWithProgress(url, fileName || `${title || 'audio'}.${url.split('?')[0].split('.').pop() || 'opus'}`, setDownloadProgress);
        if (!blob) throw new Error('Storage or network unavailable');
        setDownloadProgress(100);
      }
      
      triggerHaptic();
      toast.success('Saved offline in StudyGram');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save offline');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;
    triggerHaptic();
    
    if (isPlaying) {
      pause();
    } else {
      play(url, title || fileName, channelName, undefined, source);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioUrl) return;
    
    // If this audio isn't currently loaded, play it first at the seek position
    if (!isThisAudio) {
      play(url, title || fileName, channelName, value[0], source);
    } else {
      seek(value[0]);
    }
  };

  const skipBackward = () => {
    if (!isThisAudio) return;
    seek(Math.max(0, currentTime - 10));
  };

  const skipForward = () => {
    if (!isThisAudio) return;
    seek(Math.min(duration, currentTime + 10));
  };

  const handleSetSpeed = (speed: number) => {
    if (!audioUrl) return;
    
    // If not currently playing this audio, start it first
    if (!isThisAudio) {
      play(url, title || fileName, channelName, undefined, source);
    }
    setSpeed(speed);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };


  const handleRemoveFromCache = async () => {
    try {
      await clearFileCache(url);
      setIsCached(false);
      setAudioUrl(url);
      toast.success('Removed from offline storage');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center p-4 rounded-xl bg-secondary/60',
        className
      )}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg bg-secondary/60 overflow-hidden', className)}>
      <div className="p-2.5 flex items-start gap-2.5">
        {/* Play/Pause button with download indicator */}
        <div className="relative shrink-0">
          <Button
            size="icon"
            variant="ghost"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className={cn(
              "h-10 w-10 rounded-full",
              isPlaying ? "bg-emerald-500 hover:bg-emerald-500/90" : "bg-primary hover:bg-primary/90"
            )}
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-white" fill="white" />
            ) : (
              <Play className="h-4 w-4 text-white ml-0.5" fill="white" />
            )}
          </Button>
          {/* Download indicator */}
          {!savedOffline && <button
            aria-label="Save audio offline"
            onClick={handleDownload}
            disabled={isDownloading}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center border border-card transition-all",
              isDownloading ? "w-5 h-5" : "w-4 h-4",
              isCached ? "bg-emerald-500" : "bg-primary"
            )}
          >
            {isDownloading ? (
              <svg className="w-full h-full -rotate-90" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                <circle cx="10" cy="10" r="8" fill="none" stroke="white" strokeWidth="2" 
                  strokeDasharray={`${2 * Math.PI * 8}`}
                  strokeDashoffset={`${2 * Math.PI * 8 * (1 - downloadProgress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              </svg>
            ) : isCached ? (
              <Check className="h-2 w-2 text-white" />
            ) : (
              <ArrowDownToLine className="h-2 w-2 text-white" />
            )}
          </button>}
        </div>
        
        {/* Title and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-foreground truncate">
                {title || fileName || 'Audio recording'}
              </h3>
              {channelName && (
                <p className="text-xs text-muted-foreground mt-0.5">{channelName}</p>
              )}
            </div>
            
            {/* More options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Audio options"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                {!savedOffline && <DropdownMenuItem onClick={handleDownload} className="text-foreground focus:bg-secondary focus:text-foreground">
                  <Download className="h-4 w-4 mr-2" />
                  Save offline
                </DropdownMenuItem>}
                {savedOffline && (
                  <DropdownMenuItem onClick={handleRemoveFromCache} className="text-foreground focus:bg-secondary focus:text-foreground">
                    Remove from offline
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-secondary" />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Playback Speed</div>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <DropdownMenuItem 
                    key={speed}
                    onClick={() => handleSetSpeed(speed)} 
                    className={cn(
                      "text-foreground focus:bg-secondary focus:text-foreground",
                      playbackSpeed === speed && "bg-secondary"
                    )}
                  >
                    {speed}x {playbackSpeed === speed && '✓'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Time display */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
            {playbackSpeed !== 1 && isThisAudio && (
              <span className="ml-1 px-1 py-0.5 bg-secondary rounded text-[10px]">
                {playbackSpeed}x
              </span>
            )}
            {currentTime > 0 && !isThisAudio && (
              <span className="ml-1 px-1 py-0.5 bg-primary/20 text-primary rounded text-[10px]">
                Resume
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress bar with controls */}
      <div className="px-2.5 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={skipBackward}
            disabled={!isThisAudio}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer flex-1"
          />
          
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={skipForward}
            disabled={!isThisAudio}
          >
            <RotateCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
