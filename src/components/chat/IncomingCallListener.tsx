import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, User } from 'lucide-react';
import { Avatar } from './Avatar';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCallSounds } from '@/hooks/useCallSounds';

interface IncomingCall {
    id: string;
    conversation_id: string;
    started_by: string;
    call_type: 'voice';
    caller_profile?: {
        username: string;
        full_name: string | null;
        avatar_url: string | null;
    };
}

export const IncomingCallListener = () => {
    const { user } = useAuth();
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [declining, setDeclining] = useState(false);
    const navigate = useNavigate();
    const { playRingtone, stopRingtone } = useCallSounds();
    const ringtoneInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!user) return;

        let disposed = false;
        const channel = supabase
            .channel(`global-call-listener-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'calls',
                    filter: 'is_active=eq.true'
                },
                async (payload: any) => {
                    const newCall = payload.new;
                    if (newCall.started_by === user.id) return;

                    const { data: participation } = await supabase
                        .from('conversation_participants')
                        .select('role')
                        .eq('conversation_id', newCall.conversation_id)
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (participation && !disposed) {
                        const { data: conversation } = await supabase.from('conversations').select('type, name').eq('id', newCall.conversation_id).single();
                        const { data: active } = await supabase.from('calls').select('is_active').eq('id', newCall.id).single();
                        if (disposed || !active?.is_active) return;
                        if (conversation?.type !== 'direct') {
                            toast(conversation?.name || 'Study session', { id: 'call-' + newCall.id, description: 'A live audio session has started.', action: { label: 'Open', onClick: () => navigate('/', { state: { conversationId: newCall.conversation_id } }) }, duration: 12000 });
                            return;
                        }
                        const { data: callerProfile } = await supabase
                            .from('profiles')
                            .select('username, full_name, avatar_url')
                            .eq('user_id', newCall.started_by)
                            .single();

                        if (disposed) return;
                        const { data: stillActive } = await supabase.from('calls').select('is_active').eq('id', newCall.id).single();
                        if (disposed || !stillActive?.is_active) return;
                        setIncomingCall({
                            ...newCall,
                            caller_profile: callerProfile || { username: 'Unknown User', full_name: 'Unknown', avatar_url: null }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            disposed = true;
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Handle ringtone looping and vibration
    useEffect(() => {
        let vibrationInterval: ReturnType<typeof setInterval> | null = null;
        const expires = incomingCall ? setTimeout(() => setIncomingCall(null), 45000) : null;
        
        if (incomingCall) {
            playRingtone();
            ringtoneInterval.current = setInterval(() => {
                playRingtone();
            }, 3000);
            
            // Vibrate on mobile devices
            if ('vibrate' in navigator) {
                // Initial vibration pattern: vibrate 500ms, pause 200ms, vibrate 500ms
                navigator.vibrate([500, 200, 500]);
                
                // Repeat vibration every 2 seconds
                vibrationInterval = setInterval(() => {
                    navigator.vibrate([500, 200, 500]);
                }, 2000);
            }
        } else {
            if (ringtoneInterval.current) {
                clearInterval(ringtoneInterval.current);
                ringtoneInterval.current = null;
            }
            // Stop any playing ringtone sounds immediately
            stopRingtone();
            
            // Stop vibration
            if ('vibrate' in navigator) {
                navigator.vibrate(0);
            }
        }
        return () => {
            if (expires) clearTimeout(expires);
            if (ringtoneInterval.current) {
                clearInterval(ringtoneInterval.current);
            }
            if (vibrationInterval) {
                clearInterval(vibrationInterval);
            }
            stopRingtone();
            // Stop vibration on cleanup
            if ('vibrate' in navigator) {
                navigator.vibrate(0);
            }
        };
    }, [incomingCall, playRingtone, stopRingtone]);

    useEffect(() => {
        if (!incomingCall) return;

        const channel = supabase
            .channel(`incoming-call-status-${incomingCall.id}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'calls',
                    filter: `id=eq.${incomingCall.id}`
                },
                (payload: any) => {
                    if (!payload.new.is_active) {
                        setIncomingCall(null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [incomingCall]);

    const handleAccept = () => {
        if (incomingCall) {
            stopRingtone();
            // Navigate with autoJoin flag to bypass secondary join click
            navigate('/', {
                state: {
                    conversationId: incomingCall.conversation_id,
                    autoJoin: true,
                    callId: incomingCall.id,
                    callType: incomingCall.call_type
                }
            });
            setIncomingCall(null);
        }
    };

    const handleDecline = async () => {
        if (!incomingCall || declining) return;
        setDeclining(true);
        try {
            const { error } = await supabase.from('calls').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', incomingCall.id).select('id').single();
            if (error) throw error;
            stopRingtone(); setIncomingCall(null);
        } catch { toast.error('Could not decline the call. Check your connection and try again.'); }
        finally { setDeclining(false); }
    };

    if (!incomingCall) return null;

    return (
        <Dialog open={!!incomingCall} onOpenChange={(open) => { if (!open) { stopRingtone(); setIncomingCall(null); } }}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden border-white/10 rounded-[2rem] shadow-2xl bg-[#181521] text-white">
                <DialogTitle className="sr-only">Incoming voice call</DialogTitle>
                <DialogDescription className="sr-only">Accept to connect your microphone, or decline this invitation.</DialogDescription>
                {/* Immersive Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-400/15 via-transparent to-emerald-300/5" />

                <div className="relative flex flex-col items-center p-8 gap-8">
                    <div className="text-center space-y-2 mt-4">
                        <h2 className="text-violet-300 font-semibold tracking-widest text-xs uppercase">Someone’s calling</h2>
                        <div className="flex items-center justify-center gap-2 text-primary/60">
                            <Phone className="h-4 w-4 animate-pulse" />
                            <span className="text-xs text-white/50">StudyGram voice call</span>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-0 rounded-full bg-primary/20 scale-150 blur-3xl" />
                        <Avatar
                            name={incomingCall.caller_profile?.full_name || incomingCall.caller_profile?.username || 'Unknown'}
                            src={incomingCall.caller_profile?.avatar_url || undefined}
                            size="xl"
                            className="rounded-full shadow-2xl relative z-10"
                        />
                        <div className="absolute -inset-3 rounded-full border border-violet-300/30 motion-safe:animate-ping opacity-20 pointer-events-none" />
                        <div className="absolute -inset-2 rounded-full border-2 border-primary/30 animate-pulse pointer-events-none" />
                    </div>

                    <div className="text-center space-y-1 z-10">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                            {incomingCall.caller_profile?.full_name || incomingCall.caller_profile?.username}
                        </h3>
                        <p className="text-slate-400 font-medium">@{incomingCall.caller_profile?.username}</p>
                    </div>

                    <div className="flex gap-12 mt-4 mb-8 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Button
                                variant="destructive"
                                size="lg"
                                className="rounded-full h-16 w-16 p-0 shadow-lg hover:shadow-red-500/40 transition-all hover:scale-110 active:scale-95 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                                aria-label="Decline call"
                                disabled={declining}
                                onClick={handleDecline}
                            >
                                <PhoneOff className="h-7 w-7" />
                            </Button>
                            <span className="text-xs font-medium text-rose-300">{declining ? 'Declining…' : 'Decline'}</span>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <Button
                                variant="default"
                                size="lg"
                                className="rounded-full h-16 w-16 p-0 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/40 transition-all hover:scale-110 active:scale-95 animate-bounce-subtle"
                                aria-label="Accept call"
                                disabled={declining}
                                onClick={handleAccept}
                            >
                                <Phone className="h-7 w-7" />
                            </Button>
                            <span className="text-xs font-medium text-emerald-300">Answer</span>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes bounce-subtle {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                    .animate-bounce-subtle {
                        animation: bounce-subtle 2s infinite ease-in-out;
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .animate-bounce-subtle { animation: none; }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
};
