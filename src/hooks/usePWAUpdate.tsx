import { useEffect, useRef, useState } from 'react';
import { hasActiveCall } from '@/lib/callActivity';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const updateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (updateTimer.current) clearInterval(updateTimer.current); }, []);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service worker registered:', swUrl);
      
      // Check for updates every 60 seconds
      if (registration) {
        if (updateTimer.current) clearInterval(updateTimer.current);
        updateTimer.current = setInterval(() => {
          if (document.visibilityState === 'visible' && !hasActiveCall()) void registration.update().catch(() => {});
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Registration error:', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New content available!');
      setShowUpdatePrompt(true);
    },
  });

  const applyUpdate = async () => {
    if (hasActiveCall()) return;
    console.log('[PWA] Applying update...');
    await updateServiceWorker(true);
    setShowUpdatePrompt(false);
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
    setShowUpdatePrompt(false);
  };

  return {
    showUpdatePrompt: showUpdatePrompt || needRefresh,
    applyUpdate,
    dismissUpdate,
  };
}
