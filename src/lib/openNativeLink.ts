import { Capacitor } from '@capacitor/core';
import { safeWebUrl } from './messageLinks';

export async function openNativeLink(value: string): Promise<boolean> {
  const url = safeWebUrl(value);
  if (!url || !Capacitor.isNativePlatform()) return false;
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, toolbarColor: '#171322', presentationStyle: 'fullscreen' });
  return true;
}
