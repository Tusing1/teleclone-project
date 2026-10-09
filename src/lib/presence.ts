export function activePresenceIds(state: Record<string, { seen_at?: number }[]>, now = Date.now()) {
  return Object.entries(state).filter(([, sessions]) => sessions.some(session => typeof session.seen_at === 'number' && Number.isFinite(session.seen_at) && now - session.seen_at < 90000 && session.seen_at <= now + 60000)).map(([id]) => id);
}
