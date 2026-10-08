// Prevent an application update from reloading an ongoing audio session.
const sessions = new Set<symbol>();
const listeners = new Set<() => void>();
export const hasActiveCall = () => sessions.size > 0;
export const subscribeCallActivity = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function holdCallActivity() {
  const id = Symbol('audio session'); sessions.add(id); listeners.forEach(listener => listener());
  return () => { sessions.delete(id); listeners.forEach(listener => listener()); };
}
