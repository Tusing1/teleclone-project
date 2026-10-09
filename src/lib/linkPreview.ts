import { get, set } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';
import { publicPreviewUrl, STUDYGRAM_HOSTS } from './linkPolicy';
import { safeWebUrl } from './messageLinks';

export interface LinkPreviewData {
  url: string; title?: string; description?: string; image?: string; favicon?: string; siteName?: string;
}
const pending = new Map<string, Promise<LinkPreviewData>>();
const DAY = 86400000;
let cacheWrites = Promise.resolve();
export function basicLinkPreview(value: string): LinkPreviewData | null {
  const safe = safeWebUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const hostname = url.hostname.replace(/^www\./, '');
  if (STUDYGRAM_HOSTS.includes(url.hostname) && !url.port) return {
    url: safe, siteName: 'StudyGram', title: 'StudyGram — study together',
    description: 'Share knowledge, find study buddies, and stay connected.',
    image: '/brand/studygram-512.png', favicon: '/brand/studygram-32.png',
  };
  const preview: LinkPreviewData = { url: safe, siteName: hostname, title: url.pathname === '/' ? hostname : decodePath(url.pathname),
    favicon: publicPreviewUrl(safe) ? `${url.origin}/favicon.ico` : undefined };
  if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com') {
    const id = hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) preview.image = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    preview.siteName = 'YouTube';
  }
  return preview;
}
function decodePath(path: string): string { try { return decodeURIComponent(path.slice(1)).split('/').join(' › '); } catch { return path.slice(1); } }

export async function loadLinkPreview(value: string): Promise<LinkPreviewData> {
  const basic = basicLinkPreview(value);
  if (!basic) throw new Error('Unsupported link');
  const publicUrl = publicPreviewUrl(value);
  if (!publicUrl || STUDYGRAM_HOSTS.includes(new URL(value).hostname)) return basic;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return basic;
  const key = `link-previews:v1:${session.user.id}`;
  const requestKey = `${key}:${publicUrl}`;
  if (pending.has(requestKey)) return pending.get(requestKey)!;
  const job = (async () => {
    let cached: { url: string; at: number; data: LinkPreviewData }[] = [];
    try { cached = await get(key) || []; } catch { /* storage may be unavailable */ }
    const match = cached.find(item => item.url === publicUrl);
    if (match && (Date.now() - match.at < DAY || !navigator.onLine)) return match.data;
    if (!navigator.onLine) return basic;
    try {
      const endpoint = STUDYGRAM_HOSTS.includes(window.location.hostname) ? '/api/link-preview' : 'https://studdybuddyapp.com/api/link-preview';
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ url: publicUrl }),
      });
      if (!response.ok) return match?.data || basic;
      const result = await response.json();
      const data: LinkPreviewData = { ...basic };
      for (const field of ['title', 'description', 'siteName'] as const) if (typeof result[field] === 'string') data[field] = result[field].slice(0, 300);
      for (const field of ['image', 'favicon'] as const) if (typeof result[field] === 'string' && publicPreviewUrl(result[field])) data[field] = result[field];
      const write = cacheWrites.then(async () => {
        const latest = await get(key) || [];
        await set(key, [{ url: publicUrl, at: Date.now(), data }, ...latest.filter(item => item.url !== publicUrl)].slice(0, 100));
      });
      cacheWrites = write.catch(() => {});
      await cacheWrites;
      return data;
    } catch { return match?.data || basic; }
  })();
  pending.set(requestKey, job);
  try { return await job; } finally { pending.delete(requestKey); }
}
