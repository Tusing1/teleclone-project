import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { Avatar } from './Avatar';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!user) return;

        console.log('Attaching global call listener');

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
                    if (newCall.started_by === user.id) return; // Ignore calls started by self

                    console.log('📞 Detected new call:', newCall);
                    console.log('📞 Checking participation for user:', user.id, 'conversation:', newCall.conversation_id);

                    // Check if we are a participant in this conversation
                    const { data: participation, error: partError } = await supabase
                        .from('conversation_participants')
                        .select('role')
                        .eq('conversation_id', newCall.conversation_id)
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (partError) {
                        console.error('📞 Error checking participation:', partError);
                    }

                    console.log('📞 Participation result:', participation);

                    if (participation) {
                        try {
                            // We are relevant! Fetch caller info
                            const { data: callerProfile, error: profileError } = await supabase
                                .from('profiles')
                                .select('username, full_name, avatar_url')
                                .eq('user_id', newCall.started_by)
                                .single();

                            if (profileError) console.error('📞 Error fetching caller profile:', profileError);

                            console.log('📞 Setting incoming call with profile:', callerProfile);

                            setIncomingCall({
                                ...newCall,
                                caller_profile: callerProfile || { username: 'Unknown User', full_name: 'Unknown', avatar_url: null }
                            });
                        } catch (err) {
                            console.error('📞 Exception in incoming call handler:', err);
                        }

                        // playRingtone();
                    } else {
                        console.log('📞 User is NOT a participant in this conversation. Ignoring call.');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Listen for call ending
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
                        toast.info('Call ended');
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
            // Navigate to home with conversationId in state - Index.tsx will select the conversation
            navigate('/', { state: { conversationId: incomingCall.conversation_id } });
            setIncomingCall(null);
            // The CallView in the chat page handles the actual joining logic
        }
    };

    const handleDecline = async () => {
        setIncomingCall(null);
        // Optional: Leave a "missed call" message? 
        // Or just strictly close UI.
    };

    if (!incomingCall) return null;

    return (
        <Dialog open={!!incomingCall} onOpenChange={(open) => !open && setIncomingCall(null)}>
            <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border-primary/20">
                <DialogHeader className="flex flex-col items-center gap-4">
                    <DialogTitle className="text-xl">Incoming Call...</DialogTitle>

                    <div className="relative">
                        <Avatar
                            name={incomingCall.caller_profile?.full_name || incomingCall.caller_profile?.username || 'Unknown'}
                            src={incomingCall.caller_profile?.avatar_url || undefined}
                            size="xl"
                            className="w-24 h-24 border-4 border-primary animate-pulse"
                        />
                        <div className="absolute inset-0 rounded-full animate-ping border-2 border-primary/50" />
                    </div>

                    <DialogDescription className="text-center text-lg font-medium text-foreground">
                        {incomingCall.caller_profile?.full_name || incomingCall.caller_profile?.username} is calling you
                    </DialogDescription>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        Incoming voice call
                    </div>
                </DialogHeader>

                <DialogFooter className="flex gap-4 sm:justify-center mt-6 w-full">
                    <Button
                        variant="destructive"
                        size="lg"
                        className="rounded-full h-14 w-14 p-0 shadow-lg hover:shadow-red-500/20"
                        onClick={handleDecline}
                    >
                        <PhoneOff className="h-6 w-6" />
                    </Button>

                    <Button
                        variant="default"
                        size="lg"
                        className="rounded-full h-14 w-14 p-0 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/20 animate-bounce"
                        onClick={handleAccept}
                    >
                        <Phone className="h-6 w-6" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
