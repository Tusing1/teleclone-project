import { useState, useEffect } from 'react';
import { Mic, Download, Trash2, Play, Calendar, Clock, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMessages } from '@/hooks/useMessages';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Recording {
  id: string;
  content: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
  conversation_name?: string;
}

interface RecordingsListProps {
  open: boolean;
  onClose: () => void;
  savedMessagesId: string;
}

export function RecordingsList({ open, onClose, savedMessagesId }: RecordingsListProps) {
  const { user } = useAuth();
  const { messages } = useMessages(savedMessagesId);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!savedMessagesId || !open) return;

    // Filter messages to get only recordings
    const recordingMessages = messages.filter(
      msg => msg.message_type === 'file' && 
      msg.file_url && 
      (msg.file_name?.endsWith('.webm') || msg.content?.includes('Recording'))
    );

    // Get conversation names for recordings
    const fetchConversationNames = async () => {
      const conversationIds = [...new Set(recordingMessages.map(m => m.conversation_id))];
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, name')
        .in('id', conversationIds);

      const recordingsWithNames: Recording[] = recordingMessages.map(msg => {
        const conv = conversations?.find(c => c.id === msg.conversation_id);
        return {
          id: msg.id,
          content: msg.content || 'Call Recording',
          file_url: msg.file_url!,
          file_name: msg.file_name || 'recording.webm',
          file_size: msg.file_size || 0,
          created_at: msg.created_at,
          conversation_name: conv?.name || undefined
        };
      });

      // Sort by date (newest first)
      recordingsWithNames.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecordings(recordingsWithNames);
      setLoading(false);
    };

    fetchConversationNames();
  }, [messages, savedMessagesId, open]);

  const filteredRecordings = recordings.filter(recording =>
    recording.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recording.conversation_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePlay = (recording: Recording) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${recording.content}</title>
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
              <h1>${recording.content}</h1>
              <audio controls autoplay>
                <source src="${recording.file_url}" type="audio/webm">
                Your browser does not support the audio element.
              </audio>
              <div class="info">
                Recorded on ${format(new Date(recording.created_at), 'PPpp')}
                ${recording.conversation_name ? ` • From: ${recording.conversation_name}` : ''}
                • Size: ${formatFileSize(recording.file_size)}
              </div>
            </div>
          </body>
        </html>
      `);
    }
  };

  const handleDownload = (recording: Recording) => {
    window.open(recording.file_url, '_blank');
  };

  const handleDelete = async (recording: Recording) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', recording.id);

    if (error) {
      toast.error('Failed to delete recording');
    } else {
      toast.success('Recording deleted');
      setRecordings(recordings.filter(r => r.id !== recording.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recordings
          </DialogTitle>
          <DialogDescription>
            View and manage your call recordings saved in Saved Messages.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">Loading recordings...</div>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mic className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No recordings found' : 'No recordings yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? 'Try a different search term' : 'Recordings will appear here after calls are recorded'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecordings.map((recording) => (
                <div
                  key={recording.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-4 w-4 text-primary" />
                        <h3 className="font-medium text-sm truncate">{recording.content}</h3>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {recording.conversation_name && (
                          <div className="text-xs">
                            From: <span className="font-medium">{recording.conversation_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(recording.created_at), 'PPp')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatFileSize(recording.file_size)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlay(recording)}
                        className="text-xs"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Play
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(recording)}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(recording)}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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

