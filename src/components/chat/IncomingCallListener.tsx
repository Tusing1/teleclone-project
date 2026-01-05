import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
    const navigate = useNavigate();
    const { playRingtone, stopRingtone } = useCallSounds();
    const ringtoneInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('global-call-listener')
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

                    if (participation) {
                        const { data: callerProfile } = await supabase
                            .from('profiles')
                            .select('username, full_name, avatar_url')
                            .eq('user_id', newCall.started_by)
                            .single();

                        setIncomingCall({
                            ...newCall,
                            caller_profile: callerProfile || { username: 'Unknown User', full_name: 'Unknown', avatar_url: null }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Handle ringtone looping
    useEffect(() => {
        if (incomingCall) {
            playRingtone();
            ringtoneInterval.current = setInterval(() => {
                playRingtone();
            }, 3000);
        } else {
            if (ringtoneInterval.current) {
                clearInterval(ringtoneInterval.current);
                ringtoneInterval.current = null;
            }
            // Stop any playing ringtone sounds immediately
            stopRingtone();
        }
        return () => {
            if (ringtoneInterval.current) {
                clearInterval(ringtoneInterval.current);
            }
            stopRingtone();
        };
    }, [incomingCall, playRingtone, stopRingtone]);

    useEffect(() => {
        if (!incomingCall) return;

        const channel = supabase
            .channel(`incoming-call-status-${incomingCall.id}`)
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

    const handleDecline = () => {
        setIncomingCall(null);
    };

    if (!incomingCall) return null;

    return (
        <Dialog open={!!incomingCall} onOpenChange={(open) => !open && handleDecline()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-900 border-none rounded-3xl shadow-2xl">
                {/* Immersive Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />

                <div className="relative flex flex-col items-center p-8 gap-8">
                    <div className="text-center space-y-2 mt-4">
                        <h2 className="text-primary font-bold tracking-widest text-sm uppercase">Incoming Call</h2>
                        <div className="flex items-center justify-center gap-2 text-primary/60">
                            <Phone className="h-4 w-4 animate-pulse" />
                            <span className="text-xs">Secure Voice Connection</span>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-0 rounded-full bg-primary/20 scale-150 blur-3xl" />
                        <Avatar
                            name={incomingCall.caller_profile?.full_name || incomingCall.caller_profile?.username || 'Unknown'}
                            src={incomingCall.caller_profile?.avatar_url || undefined}
                            className="w-32 h-32 border-4 border-slate-800 shadow-2xl relative z-10"
                        />
                        <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20 pointer-events-none" />
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
                                onClick={handleDecline}
                            >
                                <PhoneOff className="h-7 w-7" />
                            </Button>
                            <span className="text-xs font-semibold text-red-500/70 uppercase tracking-wider">Decline</span>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <Button
                                variant="default"
                                size="lg"
                                className="rounded-full h-16 w-16 p-0 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/40 transition-all hover:scale-110 active:scale-95 animate-bounce-subtle"
                                onClick={handleAccept}
                            >
                                <Phone className="h-7 w-7" />
                            </Button>
                            <span className="text-xs font-semibold text-green-500/70 uppercase tracking-wider">Accept</span>
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
                `}</style>
            </DialogContent>
        </Dialog>
    );
};
