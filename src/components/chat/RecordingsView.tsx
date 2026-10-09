import { DownloadedFilesDialog } from './DownloadedFilesDialog';
import { MediaViewer } from './MediaViewer';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { ChannelAudioPlayer } from './ChannelAudioPlayer';
import { Search, ArrowLeft, Mic, Clock, Calendar, Download, Trash2, MoreVertical, Video, Radio, Send, Users, Forward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mediaKind } from '@/lib/media';

interface Recording {
    id: string;
    title: string;
    url: string;
    created_at: string;
    type: 'call' | 'livestream' | 'voice_message';
    duration?: number;
    file_size?: number;
    conversation_id: string;
    file_name?: string;
}

interface RecordingsViewProps {
    onBack: () => void;
}

export function RecordingsView({ onBack }: RecordingsViewProps) {
    const { user } = useAuth();
    const [showDownloaded, setShowDownloaded] = useState(false);
  const [preview, setPreview] = useState<Recording | null>(null);
    const { conversations } = useConversations();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [forwardRecording, setForwardRecording] = useState<Recording | null>(null);
    const [forwardSearch, setForwardSearch] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAllRecordings();
        }
    }, [user]);

    const fetchAllRecordings = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const allRecordings: Recording[] = [];

            // 1. Fetch call recordings from calls table
            const { data: callRecordings, error: callError } = await supabase
                .from('calls')
                .select('*')
                .not('recording_url', 'is', null)
                .order('started_at', { ascending: false });

            if (callError) {
                console.error('Error fetching call recordings:', callError);
            } else if (callRecordings) {
                callRecordings.forEach(call => {
                    if (call.recording_url) {
                        allRecordings.push({
                            id: call.id,
                            conversation_id: call.conversation_id,
                            title: call.recording_title || call.livestream_title || `${call.call_type === 'livestream' ? 'Livestream' : 'Call'} Recording`,
                            url: call.recording_url,
                            created_at: call.started_at,
                            type: call.call_type === 'livestream' ? 'livestream' : 'call',
                        });
                    }
                });
            }

            // 2. Fetch voice messages from messages table (audio files)
            const { data: voiceMessages, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('message_type', 'file')
                .order('created_at', { ascending: false });

            if (msgError) {
                console.error('Error fetching voice messages:', msgError);
            } else if (voiceMessages) {
                voiceMessages.forEach(msg => {
                    if (msg.file_url && mediaKind(msg.file_name || '', msg.file_url) === 'audio') {
                        allRecordings.push({
                            id: msg.id,
                            conversation_id: msg.conversation_id,
                            file_name: msg.file_name || undefined,
                            title: msg.file_name?.replace(/\.[^/.]+$/, '') || msg.content || 'Voice Recording',
                            url: msg.file_url,
                            created_at: msg.created_at,
                            type: 'voice_message',
                            file_size: msg.file_size || undefined,
                        });
                    }
                });
            }

            // Sort all recordings by date (newest first)
            allRecordings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setRecordings(allRecordings);
        } catch (error) {
            console.error('Error fetching recordings:', error);
            toast.error('Failed to load recordings');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (recording: Recording) => {
        try {
            if (recording.type === 'voice_message') {
                const { error } = await supabase
                    .from('messages')
                    .delete()
                    .eq('id', recording.id);

                if (error) throw error;
            } else {
                // For call recordings, just clear the recording URL
                const { error } = await supabase
                    .from('calls')
                    .update({ recording_url: null, recording_title: null })
                    .eq('id', recording.id);

                if (error) throw error;
            }

            setRecordings(prev => prev.filter(r => r.id !== recording.id));
            toast.success('Recording deleted');
        } catch (error) {
            console.error('Error deleting recording:', error);
            toast.error('Failed to delete recording');
        }
    };

    const handleForward = async (conversationId: string) => {
        if (!forwardRecording || !user) return;

        setSending(true);
        try {
            const { error } = await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: user.id,
                message_type: 'file',
                content: `🎙️ ${forwardRecording.title}`,
                file_url: forwardRecording.url,
                file_name: forwardRecording.file_name || `${forwardRecording.title}.${forwardRecording.url.split('?')[0].split('.').pop() || 'webm'}`,
            });

            if (error) throw error;

            toast.success('Recording forwarded');
            setForwardRecording(null);
            setForwardSearch('');
        } catch (error) {
            console.error('Error forwarding recording:', error);
            toast.error('Failed to forward recording');
        } finally {
            setSending(false);
        }
    };

    const getTypeIcon = (type: Recording['type']) => {
        switch (type) {
            case 'call':
                return <Video className="h-6 w-6 text-blue-400" />;
            case 'livestream':
                return <Radio className="h-6 w-6 text-red-400" />;
            default:
                return <Mic className="h-6 w-6 text-primary" />;
        }
    };

    const getTypeBadge = (type: Recording['type']) => {
        switch (type) {
            case 'call':
                return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded-full">Call</span>;
            case 'livestream':
                return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-medium rounded-full">Live</span>;
            default:
                return <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-medium rounded-full">Voice</span>;
        }
    };

    const filteredRecordings = recordings.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group recordings by date
    const groupedRecordings = filteredRecordings.reduce((groups, recording) => {
        const date = format(new Date(recording.created_at), 'yyyy-MM-dd');
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(recording);
        return groups;
    }, {} as Record<string, Recording[]>);

    // Filter conversations for forward dialog
    const filteredConversations = conversations.filter((c) => {
        if (c.isSavedMessages) return false;
        const name = c.name || c.participants.find(p => p.user_id !== user?.id)?.profile?.full_name || '';
        return name.toLowerCase().includes(forwardSearch.toLowerCase());
    });

    const getConversationIcon = (conversation: any) => {
        if (conversation.type === 'channel') {
            return (
                <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-white" />
                </div>
            );
        }
        if (conversation.type === 'group') {
            return (
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                </div>
            );
        }
        const otherProfile = conversation.participants?.find((p: any) => p.user_id !== user?.id)?.profile;
        return (
            <Avatar
                src={otherProfile?.avatar_url}
                name={otherProfile?.full_name || otherProfile?.username || 'User'}
                size="sm"
            />
        );
    };

    const getConversationName = (conversation: any) => {
        if (conversation.type === 'group' || conversation.type === 'channel') {
            return conversation.name || 'Unnamed';
        }
        const otherProfile = conversation.participants?.find((p: any) => p.user_id !== user?.id)?.profile;
        return otherProfile?.full_name || otherProfile?.username || 'Unknown';
    };

    return (
        <>
            {showDownloaded && <DownloadedFilesDialog onClose={() => setShowDownloaded(false)} />}
            {preview && <MediaViewer open onClose={() => setPreview(null)} url={preview.url} fileName={`${preview.title}.webm`} />}
            <div className="flex flex-col h-full bg-[#0f111a]/80 backdrop-blur-xl md:rounded-2xl md:m-2 md:shadow-2xl border border-white/5 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-white/5">
                    <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <Button variant="secondary" size="sm" className="rounded-full float-right" onClick={() => setShowDownloaded(true)}><Download className="h-4 w-4 mr-2" />Downloaded</Button>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Mic className="h-5 w-5 text-primary" />
                            My Vault
                        </h2>
                        <p className="text-xs text-muted-foreground">{recordings.length} recordings from all sources</p>
                    </div>
                    <div className="relative w-full max-w-xs hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search recordings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 rounded-full h-9 text-sm focus-visible:ring-primary/50"
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-muted-foreground animate-pulse">Scanning all your recordings...</p>
                        </div>
                    ) : filteredRecordings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                                <Mic className="h-12 w-12 text-primary/40" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {searchQuery ? 'No recordings found' : 'No recordings yet'}
                            </h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">
                                {searchQuery ? 'Try a different search term.' : 'Your call recordings, livestream recordings, and voice messages will appear here.'}
                            </p>
                        </div>
                    ) : (
                        Object.entries(groupedRecordings).map(([date, dateRecordings]) => (
                            <div key={date}>
                                {/* Date Header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-px flex-1 bg-white/10" />
                                    <span className="text-xs font-medium text-muted-foreground px-3 py-1 bg-white/5 rounded-full">
                                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                                    </span>
                                    <div className="h-px flex-1 bg-white/10" />
                                </div>

                                {/* Recordings for this date */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {dateRecordings.map((recording) => (
                                        <div
                                            key={recording.id}
                                            className="group relative bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01]"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/10 flex items-center justify-center shrink-0 border border-white/10 shadow-lg shadow-black/20">
                                                    {getTypeIcon(recording.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <h3 className="font-semibold text-white truncate text-base">
                                                                {recording.title}
                                                            </h3>
                                                            {getTypeBadge(recording.type)}
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
                                                                <DropdownMenuItem onClick={() => setForwardRecording(recording)} className="gap-2 cursor-pointer">
                                                                    <Forward className="h-4 w-4" /> Forward
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => setPreview(recording)} className="gap-2 cursor-pointer">
                                                                    <Download className="h-4 w-4" /> Open / save offline
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDelete(recording)} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                                                    <Trash2 className="h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3 text-primary/60" />
                                                            {format(new Date(recording.created_at), 'h:mm a')}
                                                        </div>
                                                        {recording.file_size && (
                                                            <span className="opacity-60">{(recording.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                                                        )}
                                                    </div>

                                                    <ChannelAudioPlayer
                                                        url={recording.url}
                                                        title={recording.title}
                                                        fileName={recording.file_name}
                                                        source={{ conversationId: recording.conversation_id, messageId: recording.type === 'voice_message' ? recording.id : undefined, label: conversations.find(conversation => conversation.id === recording.conversation_id)?.name || 'Conversation' }}
                                                        className="bg-black/40 border-white/5 rounded-xl p-2 shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Forward Dialog */}
            <Dialog open={!!forwardRecording} onOpenChange={() => setForwardRecording(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5" />
                            Forward Recording
                        </DialogTitle>
                    </DialogHeader>

                    {/* Preview of recording */}
                    {forwardRecording && (
                        <div className="p-3 bg-muted rounded-lg text-sm mb-2 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                {getTypeIcon(forwardRecording.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                    {forwardRecording.title}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                    {forwardRecording.type.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search chats..."
                            value={forwardSearch}
                            onChange={(e) => setForwardSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Conversation list */}
                    <ScrollArea className="h-64">
                        <div className="space-y-1">
                            {filteredConversations.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No chats found</p>
                            ) : (
                                filteredConversations.map((conversation) => (
                                    <button
                                        key={conversation.id}
                                        onClick={() => handleForward(conversation.id)}
                                        disabled={sending}
                                        className={cn(
                                            'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left',
                                            sending && 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        {getConversationIcon(conversation)}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{getConversationName(conversation)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {conversation.type === 'channel' ? 'Channel' :
                                                    conversation.type === 'group' ? 'Group' : 'Direct'}
                                            </p>
                                        </div>
                                        <Send className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
