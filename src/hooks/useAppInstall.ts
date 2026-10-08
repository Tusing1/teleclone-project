import { useSyncExternalStore } from 'react';
import { appInstall } from '@/lib/appInstall';

export function useAppInstall() {
  const state = useSyncExternalStore(appInstall.subscribe, appInstall.getSnapshot);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { ...state, isIOS, install: appInstall.install };
}
