import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ScheduledCall {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  call_type: string;
  is_cancelled: boolean;
  created_at: string;
}

interface ScheduleCallDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}

export function ScheduleCallDialog({
  open,
  onClose,
  conversationId,
}: ScheduleCallDialogProps) {
  const { user } = useAuth();
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // New call form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (open) {
      fetchScheduledCalls();
    }
  }, [open, conversationId]);

  const fetchScheduledCalls = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_cancelled', false)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setScheduledCalls(data as ScheduledCall[]);
    }
    setLoading(false);
  };

  const handleCreateCall = async () => {
    if (!user || !title.trim() || !scheduledDate || !scheduledTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledAt <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setCreating(true);
    const { error } = await supabase
      .from('scheduled_calls')
      .insert({
        conversation_id: conversationId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_at: scheduledAt.toISOString(),
        call_type: 'voice',
      });

    setCreating(false);

    if (error) {
      toast.error('Failed to schedule call');
    } else {
      toast.success('Call scheduled! Members will be notified.');
      setTitle('');
      setDescription('');
      setScheduledDate('');
      setScheduledTime('');
      setShowForm(false);
      fetchScheduledCalls();
    }
  };

  const handleCancelCall = async (callId: string) => {
    const { error } = await supabase
      .from('scheduled_calls')
      .update({ is_cancelled: true })
      .eq('id', callId);

    if (error) {
      toast.error('Failed to cancel call');
    } else {
      toast.success('Call cancelled');
      fetchScheduledCalls();
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-800 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Calendar className="h-5 w-5" />
            Schedule Call
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Schedule calls for your channel members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {showForm ? (
            <div className="space-y-4 p-3 rounded-lg bg-slate-700/50">
              <div className="flex items-center justify-between">
                <Label className="text-slate-200">New Scheduled Call</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="call-title" className="text-slate-300">Title *</Label>
                  <Input
                    id="call-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Weekly Team Meeting"
                    className="mt-1 bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <Label htmlFor="call-desc" className="text-slate-300">Description</Label>
                  <Textarea
                    id="call-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                    className="mt-1 bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="call-date" className="text-slate-300">Date *</Label>
                    <Input
                      id="call-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={today}
                      className="mt-1 bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="call-time" className="text-slate-300">Time *</Label>
                    <Input
                      id="call-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="mt-1 bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>
                </div>


                <Button 
                  onClick={handleCreateCall} 
                  disabled={creating}
                  className="w-full"
                >
                  Schedule Call
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setShowForm(true)}
              variant="outline"
              className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule New Call
            </Button>
          )}

          <Separator className="bg-slate-600" />

          {/* Scheduled calls list */}
          <div>
            <Label className="text-slate-200">Upcoming Calls</Label>
            <ScrollArea className="h-[250px] mt-2">
              {loading ? (
                <div className="text-center py-4 text-slate-400">Loading...</div>
              ) : scheduledCalls.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No upcoming calls scheduled
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledCalls.map((call) => {
                    const { date, time } = formatDateTime(call.scheduled_at);
                    return (
                      <div 
                        key={call.id}
                        className="flex items-start justify-between p-3 rounded-lg bg-slate-700/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-400" />
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {call.title}
                            </p>
                          </div>
                          {call.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {call.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {time}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelCall(call.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}