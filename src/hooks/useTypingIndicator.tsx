import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TypingUser {
  userId: string;
  username: string;
}

export function useTypingIndicator(conversationId: string | null) {
  const { user, profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to typing events
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, username, isTyping } = payload.payload;
        
        // Don't show our own typing indicator
        if (userId === user.id) return;

        setTypingUsers(prev => {
          if (isTyping) {
            // Add user if not already typing
            if (!prev.find(u => u.userId === userId)) {
              return [...prev, { userId, username }];
            }
            return prev;
          } else {
            // Remove user
            return prev.filter(u => u.userId !== userId);
          }
        });

        // Auto-remove after 3 seconds of no typing
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== userId));
        }, 3000);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, user]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !user || !profile) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        username: profile.username || profile.full_name || 'User',
        isTyping
      }
    });
  }, [user, profile]);

  // Debounced typing handler
  const handleTyping = useCallback(() => {
    sendTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  }, [sendTyping]);

  // Stop typing when unmounting
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(false);
    };
  }, [sendTyping]);

  return {
    typingUsers,
    handleTyping
  };
}
