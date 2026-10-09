import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { activePresenceIds } from '@/lib/presence';

const PresenceContext = createContext<Set<string>>(new Set());
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOnline(new Set());
    if (!user) return;
    let alive = true, subscribed = false;
    const channel = supabase.channel('studygram-presence-v1', { config: { presence: { key: user.id } } });
    const sync = () => {
      if (!alive) return;
      if (!subscribed) { setOnline(new Set()); return; }
      const ids = activePresenceIds(channel.presenceState<{ seen_at: number }>());
      setOnline(new Set(ids));
    };
    const heartbeat = async () => {
      if (!alive || !subscribed) return;
      if (document.hidden || !navigator.onLine) { await channel.untrack(); sync(); return; }
      await channel.track({ seen_at: Date.now() });
      sync();
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe(status => {
      subscribed = status === 'SUBSCRIBED';
      if (subscribed) void heartbeat();
      else if (alive) setOnline(new Set());
    });
    const timer = setInterval(() => { void heartbeat(); sync(); }, 30000);
    const seenTimer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('user_id', user.id).then(() => {});
    }, 60000);
    document.addEventListener('visibilitychange', heartbeat);
    window.addEventListener('online', heartbeat); window.addEventListener('offline', heartbeat);
    return () => {
      alive = false; clearInterval(timer); clearInterval(seenTimer);
      document.removeEventListener('visibilitychange', heartbeat);
      window.removeEventListener('online', heartbeat); window.removeEventListener('offline', heartbeat);
      void channel.untrack(); void supabase.removeChannel(channel);
    };
  }, [user?.id]);
  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}
export const usePresence = () => useContext(PresenceContext);
