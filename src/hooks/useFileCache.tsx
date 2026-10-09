import { get, set, del, keys } from 'idb-keyval';
import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { storageBudget, planCacheWrite } from '@/lib/storageBudget';

export interface CachedFile {
  blob: Blob; name: string; size: number; type: string; cachedAt: number; url: string; savedOffline?: boolean;
}
const EXPIRY = 180 * 24 * 60 * 60 * 1000;
export const FILES_CHANGED = 'studygram-files-changed';
// Serialize writes per account so simultaneous downloads cannot both spend the same space.
const writes = new Map<string, Promise<void>>();

export function useFileCache() {
  const { user } = useAuth();
  const prefix = `studygram-file:${user?.id || 'signed-out'}:`;
  const fileKey = useCallback((url: string) => prefix + url, [prefix]);
  const announce = () => window.dispatchEvent(new Event(FILES_CHANGED));
  const getCachedFile = useCallback(async (url: string): Promise<CachedFile | null> => {
    try {
      const cached = await get<CachedFile>(fileKey(url));
      if (!cached) return null;
      if (!cached.savedOffline && Date.now() - cached.cachedAt > EXPIRY) {
        await del(fileKey(url)); return null;
      }
      return cached;
    } catch { return null; }
  }, [fileKey]);
  const getDownloadedFiles = useCallback(async (): Promise<CachedFile[]> => {
    const accountKeys = (await keys()).filter(key => typeof key === 'string' && key.startsWith(prefix));
    const files = await Promise.all(accountKeys.map(key => get<CachedFile>(key)));
    return files.filter((file): file is CachedFile => !!file?.savedOffline).sort((a,b) => b.cachedAt - a.cachedAt);
  }, [prefix]);
  const cacheFile = useCallback(async (url: string, blob: Blob, name: string, savedOffline = false): Promise<void> => {
    if (!user) throw new Error('Sign in to save files offline.');
    const previous = writes.get(prefix) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => gate);
    writes.set(prefix, queued);
    await previous;
    try {
    const old = await get<CachedFile>(fileKey(url));
    const accountKeys = (await keys()).filter(key => typeof key === 'string' && key.startsWith(prefix));
    const cached = (await Promise.all(accountKeys.map(async key => ({ key, file: await get<CachedFile>(key) })))).filter(row => row.file);
    const evict = planCacheWrite(cached.map(row => ({ key: String(row.key), ...row.file! })), fileKey(url), blob.size, storageBudget(user.id));
    await Promise.all(evict.map(key => del(key)));
    // Explicit saves are pinned: automatic cache cleanup never removes them.
    await set(fileKey(url), { blob, name, size: blob.size, type: blob.type, cachedAt: Date.now(), url, savedOffline: savedOffline || old?.savedOffline || false } satisfies CachedFile);
    if (savedOffline) void navigator.storage?.persist?.().catch(() => false);
    announce();
    } finally { release(); if (writes.get(prefix) === queued) writes.delete(prefix); }
  }, [user?.id, prefix, fileKey]);
  const downloadAndCache = useCallback(async (url: string, name: string, savedOffline = false): Promise<Blob | null> => {
    try {
      const cached = await getCachedFile(url);
      if (cached) {
        if (savedOffline && !cached.savedOffline) await cacheFile(url, cached.blob, name, true);
        return cached.blob;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      await cacheFile(url, blob, name, savedOffline);
      return blob;
    } catch (error) { if (savedOffline) throw error; return null; }
  }, [getCachedFile, cacheFile]);
  const saveOffline = useCallback(async (url: string, name: string) => {
    const blob = await downloadAndCache(url, name, true);
    if (!blob) throw new Error('Could not save offline. Check your connection and available storage.');
    // cacheFile requests best-effort eviction protection; the browser may decline it.
    return blob;
  }, [downloadAndCache]);
  const downloadWithProgress = useCallback(async (url: string, name: string, onProgress: (percent: number) => void): Promise<Blob | null> => {
    try {
      const cached = await getCachedFile(url);
      if (cached) { await cacheFile(url, cached.blob, name, true); onProgress(100); return cached.blob; }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const length = Number(response.headers.get('content-length'));
      if (!response.body || !length) {
        const blob = await response.blob(); await cacheFile(url, blob, name, true); onProgress(100); return blob;
      }
      const reader = response.body.getReader(); const chunks: BlobPart[] = []; let received = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        chunks.push(value as unknown as BlobPart); received += value.length; onProgress(Math.min(100, Math.round(received / length * 100)));
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
      await cacheFile(url, blob, name, true); return blob;
    } catch (error) { throw error instanceof Error ? error : new Error('Could not save offline.'); }
  }, [getCachedFile, cacheFile]);
  const isFileCached = useCallback(async (url: string) => !!(await getCachedFile(url)), [getCachedFile]);
  const clearFileCache = useCallback(async (url: string) => { await del(fileKey(url)); announce(); }, [fileKey]);
  const clearAllCache = useCallback(async () => {
    const accountKeys = (await keys()).filter(key => typeof key === 'string' && key.startsWith(prefix));
    await Promise.all(accountKeys.map(key => del(key))); announce();
  }, [prefix]);
  const getCacheStats = useCallback(async () => {
    const accountKeys = (await keys()).filter(key => typeof key === 'string' && key.startsWith(prefix));
    const files = (await Promise.all(accountKeys.map(key => get<CachedFile>(key)))).filter((file): file is CachedFile => !!file);
    return { totalFiles: files.length, totalSizeMB: files.reduce((total,file) => total + file.size, 0) / 1024 / 1024, files: files.map(file => ({ name: file.name, sizeMB: file.size / 1024 / 1024, cachedAt: file.cachedAt })) };
  }, [prefix]);
  return { getCachedFile, cacheFile, downloadAndCache, saveOffline, downloadWithProgress, isFileCached, clearFileCache, clearAllCache, getCacheStats, getDownloadedFiles };
}
