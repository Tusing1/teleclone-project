interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture once at startup, not when someone finally opens the install page.
export function createInstallStore(win: Window) {
  const display = win.matchMedia('(display-mode: standalone)');
  const standalone = () => display.matches || !!(win.navigator as Navigator & { standalone?: boolean }).standalone;
  let state = { installed: standalone(), available: false };
  let prompt: InstallEvent | null = null;
  const listeners = new Set<() => void>();
  const update = (installed = standalone()) => {
    state = { installed, available: !!prompt && !installed };
    listeners.forEach(listener => listener());
  };
  const beforeInstall = (event: Event) => { event.preventDefault(); prompt = event as InstallEvent; update(); };
  const installed = () => { prompt = null; update(true); };
  const changed = () => update();
  win.addEventListener('beforeinstallprompt', beforeInstall);
  win.addEventListener('appinstalled', installed);
  win.addEventListener('pageshow', changed);
  display.addEventListener('change', changed);
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async install() {
      const event = prompt;
      if (!event) return 'unavailable' as const;
      prompt = null; update(state.installed);
      await event.prompt(); // Must be called directly from a user gesture.
      return (await event.userChoice).outcome; // Acceptance is not proof of installation.
    },
    destroy() {
      win.removeEventListener('beforeinstallprompt', beforeInstall);
      win.removeEventListener('appinstalled', installed);
      win.removeEventListener('pageshow', changed);
      display.removeEventListener('change', changed);
      listeners.clear();
    },
  };
}

export const appInstall = createInstallStore(window);
