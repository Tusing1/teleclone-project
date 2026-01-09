import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service worker registered:', swUrl);
      
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          console.log('[PWA] Checking for updates...');
          registration.update();
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
