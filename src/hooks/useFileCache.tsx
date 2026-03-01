import { get, set, del, keys } from 'idb-keyval';
import { useCallback } from 'react';

interface CachedFile {
  blob: Blob;
  name: string;
  size: number;
  type: string;
  cachedAt: number;
  url: string;
}

const CACHE_EXPIRY_DAYS = 30;
const MAX_CACHE_SIZE_MB = 500;

export function useFileCache() {
  // Get cached file
  const getCachedFile = useCallback(async (url: string): Promise<CachedFile | null> => {
    try {
      const cached = await get<CachedFile>(`file_${btoa(url)}`);
      if (!cached) return null;
      
      // Check if expired
      const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - cached.cachedAt > expiryMs) {
        await del(`file_${btoa(url)}`);
        return null;
      }
      
      return cached;
    } catch (error) {
      console.error('Error getting cached file:', error);
      return null;
    }
  }, []);

  // Cache a file
  const cacheFile = useCallback(async (url: string, blob: Blob, name: string): Promise<void> => {
    try {
      // Check cache size and clean if needed
      await cleanCacheIfNeeded();
      
      const cachedFile: CachedFile = {
        blob,
        name,
        size: blob.size,
        type: blob.type,
        cachedAt: Date.now(),
        url
      };
      
      await set(`file_${btoa(url)}`, cachedFile);
      console.log(`Cached file: ${name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.error('Error caching file:', error);
    }
  }, []);

  // Download and cache file
  const downloadAndCache = useCallback(async (url: string, name: string): Promise<Blob | null> => {
    try {
      const cached = await getCachedFile(url);
      if (cached) return cached.blob;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');
      const blob = await response.blob();
      await cacheFile(url, blob, name);
      return blob;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }, [getCachedFile, cacheFile]);

  // Download with progress tracking
  const downloadWithProgress = useCallback(async (
    url: string, 
    name: string, 
    onProgress: (percent: number) => void
  ): Promise<Blob | null> => {
    try {
      const cached = await getCachedFile(url);
      if (cached) { onProgress(100); return cached.blob; }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');

      const contentLength = response.headers.get('content-length');
      if (!contentLength || !response.body) {
        // Fallback if no content-length header
        const blob = await response.blob();
        await cacheFile(url, blob, name);
        onProgress(100);
        return blob;
      }

      const total = parseInt(contentLength, 10);
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as unknown as BlobPart);
        received += value.length;
        onProgress(Math.round((received / total) * 100));
      }

      const blob = new Blob(chunks);
      await cacheFile(url, blob, name);
      return blob;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }, [getCachedFile, cacheFile]);

  // Check if file is cached
  const isFileCached = useCallback(async (url: string): Promise<boolean> => {
    const cached = await getCachedFile(url);
    return cached !== null;
  }, [getCachedFile]);

  // Clear specific file from cache
  const clearFileCache = useCallback(async (url: string): Promise<void> => {
    try {
      await del(`file_${btoa(url)}`);
    } catch (error) {
      console.error('Error clearing file cache:', error);
    }
  }, []);

  // Clear all cached files
  const clearAllCache = useCallback(async (): Promise<void> => {
    try {
      const allKeys = await keys();
      const fileKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith('file_')
      );
      
      for (const key of fileKeys) {
        await del(key);
      }
      
      console.log(`Cleared ${fileKeys.length} cached files`);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }, []);

  // Get cache stats
  const getCacheStats = useCallback(async (): Promise<{
    totalFiles: number;
    totalSizeMB: number;
    files: { name: string; sizeMB: number; cachedAt: Date }[];
  }> => {
    try {
      const allKeys = await keys();
      const fileKeys = allKeys.filter(key => 
        typeof key === 'string' && key.startsWith('file_')
      );
      
      let totalSize = 0;
      const files: { name: string; sizeMB: number; cachedAt: Date }[] = [];
      
      for (const key of fileKeys) {
        const cached = await get<CachedFile>(key);
        if (cached) {
          totalSize += cached.size;
          files.push({
            name: cached.name,
            sizeMB: cached.size / 1024 / 1024,
            cachedAt: new Date(cached.cachedAt)
          });
        }
      }
      
      return {
        totalFiles: files.length,
        totalSizeMB: totalSize / 1024 / 1024,
        files
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalFiles: 0, totalSizeMB: 0, files: [] };
    }
  }, []);

  return {
    getCachedFile,
    cacheFile,
    downloadAndCache,
    downloadWithProgress,
    isFileCached,
    clearFileCache,
    clearAllCache,
    getCacheStats
  };
}

// Helper to clean cache if it exceeds size limit
async function cleanCacheIfNeeded(): Promise<void> {
  try {
    const allKeys = await keys();
    const fileKeys = allKeys.filter(key => 
      typeof key === 'string' && key.startsWith('file_')
    );
    
    const files: { key: string; size: number; cachedAt: number }[] = [];
    let totalSize = 0;
    
    for (const key of fileKeys) {
      const cached = await get<CachedFile>(key);
      if (cached) {
        files.push({ key: key as string, size: cached.size, cachedAt: cached.cachedAt });
        totalSize += cached.size;
      }
    }
    
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    
    if (totalSize > maxSizeBytes) {
      // Sort by oldest first
      files.sort((a, b) => a.cachedAt - b.cachedAt);
      
      // Delete oldest files until under limit
      while (totalSize > maxSizeBytes * 0.8 && files.length > 0) {
        const oldest = files.shift();
        if (oldest) {
          await del(oldest.key);
          totalSize -= oldest.size;
          console.log(`Removed old cached file to free space`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
}
