import { useSyncExternalStore } from 'react';
const key = 'studygram-call-audio';
const defaults = { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
type Preferences = typeof defaults;
let preferences = defaults;
try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); preferences = { ...defaults, ...Object.fromEntries(Object.entries(saved).filter(([k,v]) => k in defaults && typeof v === 'boolean')) }; } catch { /* Default settings remain usable without storage. */ }
const listeners = new Set<() => void>();
export const getCallPreferences = () => preferences;
export function updateCallPreference(setting: keyof Preferences, value: boolean) {
  preferences = { ...preferences, [setting]: value };
  try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Session-only preferences. */ }
  listeners.forEach(listener => listener());
}
export function useCallPreferences() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getCallPreferences);
}
