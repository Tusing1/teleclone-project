import { useEffect, useState } from 'react';
import { FILES_CHANGED, useFileCache } from './useFileCache';
export function useOfflineStatus(url: string) {
  const { getCachedFile } = useFileCache();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    setSaved(false);
    const check = () => { void getCachedFile(url).then(file => { if (alive) setSaved(!!file?.savedOffline); }); };
    check(); window.addEventListener(FILES_CHANGED, check);
    return () => { alive = false; window.removeEventListener(FILES_CHANGED, check); };
  }, [url, getCachedFile]);
  return saved;
}
