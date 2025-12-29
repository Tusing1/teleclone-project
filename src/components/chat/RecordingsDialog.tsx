import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecordings, Recording } from '@/hooks/useRecordings';
import { useConversations } from '@/hooks/useConversations';
import { Mic, Video, Radio, Search, Forward, Play, Download, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RecordingsDialogProps {
  open: boolean;
  onClose: () => void;
  onForwardRecording: (recording: Recording) => void;
}

export function RecordingsDialog({ open, onClose, onForwardRecording }: RecordingsDialogProps) {
  const { recordings, loading } = useRecordings();
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

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
      // Open recording URL in new tab for download
      window.open(rec.recording_url, '_blank');
      toast.success('Opening recording...');
    } catch (error) {
      toast.error('Failed to download recording');
    }
  };

  const handleForward = (rec: Recording) => {
    onForwardRecording(rec);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            My Recordings
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Recordings List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-2 pb-4">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : filteredRecordings.length === 0 ? (
              <div className="text-center py-12">
                <Mic className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {search ? 'No recordings match your search' : 'No recordings yet'}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Record calls or livestreams to see them here
                </p>
              </div>
            ) : (
              filteredRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {getRecordingIcon(rec.call_type)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {getRecordingTitle(rec)}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(rec.started_at), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(rec.started_at, rec.ended_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(rec)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleForward(rec)}
                      title="Forward"
                    >
                      <Forward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
