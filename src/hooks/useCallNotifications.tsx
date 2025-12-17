import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useConversations } from './useConversations';

export function useCallNotifications() {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const notificationPermissionRef = useRef<NotificationPermission>('default');
  const notifiedCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, []);

  useEffect(() => {
    if (!user || !conversations.length) return;

    const conversationIds = conversations
      .filter(c => c.type === 'group' || c.type === 'channel')
      .map(c => c.id);

    if (conversationIds.length === 0) return;

    // Subscribe to new calls in user's conversations
    const channel = supabase
      .channel('call-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `conversation_id=in.(${conversationIds.join(',')})`
        },
        async (payload) => {
          const newCall = payload.new as any;
          
          // Don't notify if user started the call
          if (newCall.started_by === user.id) return;
          
          // Don't notify if already notified
          if (notifiedCallsRef.current.has(newCall.id)) return;
          
          notifiedCallsRef.current.add(newCall.id);

          // Get conversation name
          const conversation = conversations.find(c => c.id === newCall.conversation_id);
          const conversationName = conversation?.name || 'Group';

          // Show notification
          if (notificationPermissionRef.current === 'granted') {
            const notification = new Notification('Incoming Call', {
              body: `${conversationName} - ${newCall.call_type === 'video' ? 'Video' : 'Voice'} call started`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `call-${newCall.id}`,
              requireInteraction: false
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
            };

            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversations]);
}

