import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MessageWithSender } from '@/types/chat';
import { ChannelAudioPlayer } from './ChannelAudioPlayer';
import { Search, ArrowLeft, Mic, Clock, Calendar, Download, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RecordingsViewProps {
    onBack: () => void;
}

export function RecordingsView({ onBack }: RecordingsViewProps) {
    const { user } = useAuth();
    const [recordings, setRecordings] = useState<MessageWithSender[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (user) {
            fetchRecordings();
        }
    }, [user]);

    const fetchRecordings = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Get the "Saved Messages" conversation ID
            // We use the edge function to ensure the conversation exists
            const { data: convData } = await supabase.functions.invoke('create-conversation', {
                body: { type: 'saved' }
            });

            if (!convData?.id) {
                setRecordings([]);
                setLoading(false);
                return;
            }

            // 2. Fetch messages from this conversation that are recordings
            const { data: messages, error } = await supabase
                .from('messages')
                .select(`
          *,
          sender:profiles(*)
        `)
                .eq('conversation_id', convData.id)
                .eq('message_type', 'file')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter for audio recordings (typically .webm from our WebRTC recorder)
            const filtered = (messages || []).filter(m =>
                m.file_url && (
                    m.file_url.toLowerCase().endsWith('.webm') ||
                    m.file_url.toLowerCase().endsWith('.mp3') ||
                    m.file_url.toLowerCase().endsWith('.m4a') ||
                    m.content?.toLowerCase().includes('recording')
                )
            );

            setRecordings(filtered as unknown as MessageWithSender[]);
        } catch (error) {
            console.error('Error fetching recordings:', error);
            toast.error('Failed to load recordings');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setRecordings(prev => prev.filter(r => r.id !== id));
            toast.success('Recording deleted');
        } catch (error) {
            console.error('Error deleting recording:', error);
            toast.error('Failed to delete recording');
        }
    };

    const filteredRecordings = recordings.filter(r =>
        r.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#0f111a]/80 backdrop-blur-xl md:rounded-2xl md:m-2 md:shadow-2xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-white/5">
                <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Mic className="h-5 w-5 text-primary" />
                        My Vault
                    </h2>
                    <p className="text-xs text-muted-foreground">{recordings.length} recordings saved</p>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-muted-foreground animate-pulse">Scanning your recordings...</p>
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
                            {searchQuery ? 'Try a different search term.' : 'Your call recordings and voice notes will appear here once you save them during calls.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filteredRecordings.map((recording) => (
                            <div
                                key={recording.id}
                                className="group relative bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01]"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/10 flex items-center justify-center shrink-0 border border-white/10 shadow-lg shadow-black/20">
                                        <Mic className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="font-semibold text-white truncate text-base">
                                                {recording.file_name?.replace(/\.[^/.]+$/, '') || recording.content || 'Untitled Recording'}
                                            </h3>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
                                                    <DropdownMenuItem onClick={() => recording.file_url && window.open(recording.file_url, '_blank')} className="gap-2 cursor-pointer">
                                                        <Download className="h-4 w-4" /> Download
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(recording.id)} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                                        <Trash2 className="h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3 text-primary/60" />
                                                {format(new Date(recording.created_at), 'MMM d, yyyy')}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-primary/60" />
                                                {format(new Date(recording.created_at), 'h:mm a')}
                                            </div>
                                            {recording.file_size && (
                                                <span className="opacity-60">{(recording.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                                            )}
                                        </div>

                                        <ChannelAudioPlayer
                                            url={recording.file_url!}
                                            title=""
                                            className="bg-black/40 border-white/5 rounded-xl p-2 shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
