import { useState } from 'react';
import { ArrowLeft, Mic, Video, Radio, Forward, Download, Calendar, Clock, Search, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecordings, Recording } from '@/hooks/useRecordings';
import { ChannelAudioPlayer } from './ChannelAudioPlayer';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RecordingsViewProps {
  onBack: () => void;
  onForwardRecording: (recording: Recording) => void;
}

export function RecordingsView({ onBack, onForwardRecording }: RecordingsViewProps) {
  const { recordings, loading, refetch } = useRecordings();
  const [search, setSearch] = useState('');

  const filteredRecordings = recordings.filter(rec => {
    const title = rec.recording_title || rec.livestream_title || '';
    return title.toLowerCase().includes(search.toLowerCase());
  });

  const getRecordingIcon = (callType: string) => {
    if (callType === 'livestream') {
      return <Radio className="h-5 w-5 text-red-500" />;
    }
    if (callType === 'video') {
      return <Video className="h-5 w-5 text-blue-500" />;
    }
    return <Mic className="h-5 w-5 text-green-500" />;
  };

  const getRecordingTitle = (rec: Recording) => {
    return rec.recording_title || rec.livestream_title || `${rec.call_type} recording`;
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'In progress';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (rec: Recording) => {
    if (!rec.recording_url) return;
    try {
      window.open(rec.recording_url, '_blank');
      toast.success('Opening recording...');
    } catch (error) {
      toast.error('Failed to download recording');
    }
  };

  const handleForward = (rec: Recording) => {
    onForwardRecording(rec);
  };

  // Group recordings by date
  const groupedRecordings = filteredRecordings.reduce((groups, rec) => {
    const date = format(new Date(rec.started_at), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(rec);
    return groups;
  }, {} as Record<string, Recording[]>);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-slate-900/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <Mic className="h-5 w-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-foreground">Recordings</h1>
          <p className="text-xs text-muted-foreground">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/50 border-slate-700"
          />
        </div>
      </div>

      {/* Recordings Feed */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <div className="bg-slate-800/90 rounded-2xl p-4">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <div className="flex items-center gap-3 mt-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredRecordings.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <Mic className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {search ? 'No recordings found' : 'No recordings yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search 
                  ? 'Try a different search term' 
                  : 'Record calls or livestreams to see them here. All your recordings will appear in this feed.'}
              </p>
            </div>
          ) : (
            Object.entries(groupedRecordings).map(([date, recs]) => (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                  <span className="text-xs font-medium text-slate-500 px-2">{date}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                </div>

                {/* Recordings for this date */}
                {recs.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-800/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg group"
                  >
                    {/* Recording Type Badge */}
                    <div className="px-4 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
                          rec.call_type === 'livestream' && "bg-red-500/20 text-red-400",
                          rec.call_type === 'video' && "bg-blue-500/20 text-blue-400",
                          rec.call_type === 'audio' && "bg-green-500/20 text-green-400"
                        )}>
                          {getRecordingIcon(rec.call_type)}
                          <span className="capitalize">{rec.call_type}</span>
                        </div>
                      </div>
                      
                      {/* Options Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem 
                            onClick={() => handleDownload(rec)}
                            className="gap-2 text-slate-200 focus:bg-slate-700"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleForward(rec)}
                            className="gap-2 text-slate-200 focus:bg-slate-700"
                          >
                            <Forward className="h-4 w-4" />
                            Forward
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Audio Player */}
                    <div className="px-4 py-3">
                      <ChannelAudioPlayer
                        url={rec.recording_url}
                        title={getRecordingTitle(rec)}
                      />
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 px-4 pb-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(rec.started_at, rec.ended_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(rec.started_at), 'h:mm a')}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 px-4 pb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleForward(rec)}
                        className="h-8 px-3 rounded-full bg-slate-700/50 hover:bg-slate-600 text-slate-300 text-xs"
                      >
                        <Forward className="h-3.5 w-3.5 mr-1.5" />
                        Forward
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(rec)}
                        className="h-8 px-3 rounded-full bg-slate-700/50 hover:bg-slate-600 text-slate-300 text-xs"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
