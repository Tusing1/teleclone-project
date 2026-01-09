import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  Clock, Calendar, Loader2, History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CallsInboxDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}

interface CallRecord {
  id: string;
  call_type: string;
  started_at: string;
  ended_at: string | null;
  started_by: string;
  conversation_id: string;
  is_active: boolean;
  participant?: {
    user_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  isMissed: boolean;
  isOutgoing: boolean;
  duration?: number;
}

export function CallsInboxDialog({ open, onClose, onOpenConversation }: CallsInboxDialogProps) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      fetchCalls();
    }
  }, [open, user]);

  const fetchCalls = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get calls where user participated
      const { data: participations } = await supabase
        .from('call_participants')
        .select('call_id, joined_at, left_at')
        .eq('user_id', user.id);

      const callIds = participations?.map(p => p.call_id) || [];

      if (callIds.length === 0) {
        setCalls([]);
        setLoading(false);
        return;
      }

      // Get call details
      const { data: callsData } = await supabase
        .from('calls')
        .select('*')
        .in('id', callIds)
        .order('started_at', { ascending: false })
        .limit(50);

      if (!callsData) {
        setCalls([]);
        setLoading(false);
        return;
      }

      // Get conversation participants to find the other person
      const conversationIds = [...new Set(callsData.map(c => c.conversation_id))];
      
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      // Get profiles for other participants
      const otherUserIds = [...new Set(participants?.map(p => p.user_id) || [])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', otherUserIds);

      // Map calls with participant info
      const callRecords: CallRecord[] = callsData.map(call => {
        const otherParticipant = participants?.find(p => p.conversation_id === call.conversation_id);
        const profile = profiles?.find(p => p.user_id === otherParticipant?.user_id);
        const participation = participations?.find(p => p.call_id === call.id);
        
        // Calculate if missed (user didn't join or joined very late)
        const isMissed = !participation || 
          (new Date(participation.joined_at).getTime() - new Date(call.started_at).getTime() > 30000);
        
        // Calculate duration
        let duration = 0;
        if (call.ended_at && participation?.joined_at) {
          const start = new Date(participation.joined_at).getTime();
          const end = new Date(call.ended_at).getTime();
          duration = Math.floor((end - start) / 1000);
        }

        return {
          ...call,
          participant: profile,
          isMissed: isMissed && call.started_by !== user.id,
          isOutgoing: call.started_by === user.id,
          duration: duration > 0 ? duration : undefined,
        };
      });

      setCalls(callRecords);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getCallIcon = (call: CallRecord) => {
    if (call.isMissed) {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    if (call.isOutgoing) {
      return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-primary" />;
  };

  const handleCallBack = (call: CallRecord) => {
    onOpenConversation(call.conversation_id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Call History
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Phone className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No calls yet</h3>
              <p className="text-sm text-muted-foreground">
                Your call history will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-primary"
                  onClick={() => handleCallBack(call)}
                >
                  {/* Avatar */}
                  <Avatar
                    src={call.participant?.avatar_url}
                    name={call.participant?.full_name || call.participant?.username || 'User'}
                    size="md"
                  />

                  {/* Call info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate text-foreground">
                        {call.participant?.full_name || call.participant?.username || 'Unknown'}
                      </span>
                      {call.is_active && (
                        <Badge variant="default" className="bg-green-500 text-xs shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    
                    {/* Call details - stacked layout */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 shrink-0">
                        {getCallIcon(call)}
                        <span className={cn("font-medium", call.isMissed && "text-destructive")}>
                          {call.isMissed ? 'Missed' : call.isOutgoing ? 'Outgoing' : 'Incoming'}
                        </span>
                      </div>
                      
                      <span className="text-muted-foreground/50">•</span>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {call.call_type === 'video' ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <Phone className="w-3 h-3" />
                        )}
                        <span>{call.call_type === 'video' ? 'Video' : 'Voice'}</span>
                      </div>
                      
                      {call.duration && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(call.duration)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time - right aligned */}
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}