import { useState } from 'react';
import { History, Phone, Video, Clock, Users, Download, Play, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { useCallHistory, CallHistoryItem } from '@/hooks/useCallHistory';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}

export function CallHistoryDialog({ open, onClose, conversationId }: CallHistoryDialogProps) {
  const { callHistory, loading } = useCallHistory(conversationId);

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return 'Ongoing';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleDownloadRecording = (call: CallHistoryItem) => {
    if (call.recording_url) {
      window.open(call.recording_url, '_blank');
    }
  };

  const handlePlayRecording = (call: CallHistoryItem) => {
    if (call.recording_url) {
      // Open in new window/tab for playback
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Call Recording - ${call.recording_title || 'Recording'}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: system-ui, -apple-system, sans-serif;
                  background: #1a1a1a;
                  color: #fff;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                }
                .container {
                  max-width: 600px;
                  width: 100%;
                  background: #2a2a2a;
                  padding: 30px;
                  border-radius: 12px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }
                h1 {
                  margin: 0 0 20px 0;
                  font-size: 24px;
                }
                audio {
                  width: 100%;
                  margin-top: 20px;
                }
                .info {
                  color: #aaa;
                  font-size: 14px;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${call.recording_title || 'Call Recording'}</h1>
                <audio controls autoplay>
                  <source src="${call.recording_url}" type="audio/webm">
                  Your browser does not support the audio element.
                </audio>
                <div class="info">
                  Recorded on ${format(new Date(call.started_at), 'PPpp')}
                  ${call.duration_minutes ? ` • Duration: ${formatDuration(call.duration_minutes)}` : ''}
                </div>
              </div>
            </body>
          </html>
        `);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Call History
          </DialogTitle>
          <DialogDescription>
            View past calls and recordings for this conversation.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">Loading call history...</div>
            </div>
          ) : callHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No call history yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Calls will appear here after they end
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {callHistory.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    'p-4 rounded-lg border border-border',
                    call.is_active && 'bg-primary/5 border-primary/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {call.call_type === 'video' ? (
                          <Video className="h-4 w-4 text-primary" />
                        ) : (
                          <Phone className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-medium text-sm">
                          {call.call_type === 'video' ? 'Video Call' : 'Voice Call'}
                        </span>
                        {call.is_active && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full">
                            Active
                          </span>
                        )}
                        {call.is_recording && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            Recording
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(call.started_at), 'PPpp')}
                          </span>
                        </div>
                        {call.ended_at && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              Duration: {formatDuration(call.duration_minutes)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>{call.participant_count} participant{call.participant_count !== 1 ? 's' : ''}</span>
                        </div>
                        {call.started_by_profile && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar
                              src={call.started_by_profile.avatar_url}
                              name={call.started_by_profile.username}
                              size="xs"
                            />
                            <span className="text-xs">
                              Started by {call.started_by_profile.full_name || call.started_by_profile.username}
                            </span>
                          </div>
                        )}
                        {call.recording_title && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium">Recording:</span> {call.recording_title}
                          </div>
                        )}
                      </div>
                    </div>

                    {call.has_recording && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlayRecording(call)}
                          className="text-xs"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadRecording(call)}
                          className="text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

