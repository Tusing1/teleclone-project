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
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { toast } from 'sonner';

interface ChannelAudioPlayerProps {
  url: string;
  title?: string;
  channelName?: string;
  duration?: number;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

export function ChannelAudioPlayer({ 
  url, 
  title, 
  channelName,
  duration: initialDuration,
  className 
}: ChannelAudioPlayerProps) {
  const { audioState, play, pause, seek, setSpeed, getSavedPosition, isCurrentAudio } = useGlobalAudio();
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [localDuration, setLocalDuration] = useState(initialDuration || 0);
  
  const { isFileCached, getCachedFile, downloadAndCache, clearFileCache } = useFileCache();

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
            const objectUrl = URL.createObjectURL(cachedFile.blob);
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
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [url]);

  // Load duration from a temporary audio element if not playing
  useEffect(() => {
    if (!isThisAudio && audioUrl && !localDuration) {
      const tempAudio = new Audio(audioUrl);
      tempAudio.addEventListener('loadedmetadata', () => {
        setLocalDuration(tempAudio.duration);
      });
      return () => {
        tempAudio.src = '';
      };
    }
  }, [audioUrl, isThisAudio, localDuration]);

  const handleDownloadToCache = async () => {
    if (isCached) {
      toast.info('Already downloaded');
      return;
    }
    
    setIsDownloading(true);
    try {
      const blob = await downloadAndCache(url, title || 'audio.opus');
      if (blob) {
        setIsCached(true);
        const objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
        toast.success('Downloaded for offline playback');
      }
    } catch (error) {
      toast.error('Failed to download');
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;
    
    if (isPlaying) {
      pause();
    } else {
      play(audioUrl, title, channelName);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioUrl) return;
    
    // If this audio isn't currently loaded, play it first at the seek position
    if (!isThisAudio) {
      play(audioUrl, title, channelName, value[0]);
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
      play(audioUrl, title, channelName);
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

  const handleSaveToDevice = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'audio.opus';
    a.click();
    toast.success('Download started');
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
        'flex items-center justify-center p-4 rounded-xl bg-slate-800/80',
        className
      )}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg bg-slate-800/80 overflow-hidden', className)}>
      <div className="p-2.5 flex items-start gap-2.5">
        {/* Play/Pause button with download indicator */}
        <div className="relative shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-10 w-10 rounded-full",
              isPlaying ? "bg-emerald-500 hover:bg-emerald-500/90" : "bg-sky-500 hover:bg-sky-500/90"
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
          {!isCached && (
            <button 
              onClick={handleDownloadToCache}
              disabled={isDownloading}
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center border border-slate-800"
            >
              {isDownloading ? (
                <Loader2 className="h-2 w-2 text-white animate-spin" />
              ) : (
                <ArrowDownToLine className="h-2 w-2 text-white" />
              )}
            </button>
          )}
          {isCached && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border border-slate-800">
              <Check className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
        
        {/* Title and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-white truncate">
                {title || 'Audio Recording'}
              </h3>
              {channelName && (
                <p className="text-xs text-slate-400 mt-0.5">{channelName}</p>
              )}
            </div>
            
            {/* More options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-slate-400 hover:text-white"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-slate-700">
                <DropdownMenuItem onClick={handleSaveToDevice} className="text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                  <Download className="h-4 w-4 mr-2" />
                  Save to device
                </DropdownMenuItem>
                {isCached ? (
                  <DropdownMenuItem onClick={handleRemoveFromCache} className="text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                    Remove from offline
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleDownloadToCache} className="text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                    Download for offline
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-slate-700" />
                <div className="px-2 py-1.5 text-xs text-slate-400">Playback Speed</div>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <DropdownMenuItem 
                    key={speed}
                    onClick={() => handleSetSpeed(speed)} 
                    className={cn(
                      "text-slate-200 focus:bg-slate-700 focus:text-slate-200",
                      playbackSpeed === speed && "bg-slate-700"
                    )}
                  >
                    {speed}x {playbackSpeed === speed && '✓'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Time display */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
            {playbackSpeed !== 1 && isThisAudio && (
              <span className="ml-1 px-1 py-0.5 bg-slate-700 rounded text-[10px]">
                {playbackSpeed}x
              </span>
            )}
            {currentTime > 0 && !isThisAudio && (
              <span className="ml-1 px-1 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px]">
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
            className="h-5 w-5 text-slate-400 hover:text-white shrink-0"
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
            className="h-5 w-5 text-slate-400 hover:text-white shrink-0"
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
