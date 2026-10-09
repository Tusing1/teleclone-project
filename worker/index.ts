import { isPublicAddress, publicPreviewUrl } from '../src/lib/linkPolicy';

declare const HTMLRewriter: any;
type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  PREVIEW_RATE: { limit: (value: { key: string }) => Promise<{ success: boolean }> };
};
const AUTH_ORIGIN = 'https://plhzfgfrlxywxaccewyh.supabase.co';
const MAX_HTML = 512 * 1024;
const ALLOWED_ORIGINS = new Set(['https://studdybuddyapp.com', 'https://www.studdybuddyapp.com', 'https://localhost', 'http://localhost', 'capacitor://localhost', 'http://localhost:8080', 'http://127.0.0.1:8080']);
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function validateDestination(value: string, signal: AbortSignal, fetcher = fetch): Promise<string> {
  const safe = publicPreviewUrl(value);
  if (!safe) throw new Error('Unsupported destination');
  const host = new URL(safe).hostname;
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { Accept: 'application/dns-json' }, signal, redirect: 'error', credentials: 'omit',
    });
    if (!response.ok) throw new Error('DNS unavailable');
    const result = await response.json() as { Status?: number; Answer?: { type: number; data: string }[] };
    if (result.Status !== 0) throw new Error('DNS unavailable');
    return (result.Answer || []).filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some(ip => !isPublicAddress(ip))) throw new Error('Private destination');
  return safe;
}

export async function fetchPage(value: string, signal: AbortSignal, fetcher = fetch): Promise<{ response: Response; url: string }> {
  let next = value;
  for (let hop = 0; hop < 4; hop++) {
    const url = await validateDestination(next, signal, fetcher);
    // Never forward StudyGram cookies, authorization, or a user's browser headers.
    const response = await fetcher(url, { signal, redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'StudyGram-LinkPreview/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Invalid redirect');
      next = new URL(location, url).href;
      continue;
    }
    return { response, url };
  }
  throw new Error('Too many redirects');
}

export async function limitedHtml(response: Response): Promise<string> {
  if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('No public HTML');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  let bytes = 0;
  let html = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML) throw new Error('Page too large');
      html += decoder.decode(value, { stream: true });
      if (/<\/head\s*>/i.test(html)) break;
    }
    return html + decoder.decode();
  } finally { await reader.cancel(); }
}

export async function extractPreview(html: string, url: string) {
  const tags: Record<string, string> = {};
  let title = '';
  let icon = '';
  const clean = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max);
  const rewrite = new HTMLRewriter()
    .on('meta', { element(element: any) {
      const key = (element.getAttribute('property') || element.getAttribute('name') || '').toLowerCase();
      const content = element.getAttribute('content');
      if (content && !tags[key]) tags[key] = content.slice(0, 2048);
    } })
    .on('title', { text(chunk: any) { title += chunk.text; } })
    .on('link', { element(element: any) {
      if (/^(?:shortcut )?icon$/i.test(element.getAttribute('rel') || '') && !icon) icon = element.getAttribute('href') || '';
    } });
  await rewrite.transform(new Response(html)).text();
  const asset = (value: string) => { try { return value ? publicPreviewUrl(new URL(value, url).href) : null; } catch { return null; } };
  return {
    url,
    siteName: clean(tags['og:site_name'] || new URL(url).hostname, 100),
    title: clean(tags['og:title'] || tags['twitter:title'] || title || new URL(url).hostname, 200),
    description: clean(tags['og:description'] || tags['twitter:description'] || tags.description || '', 300),
    image: asset(tags['og:image'] || tags['twitter:image'] || '') || undefined,
    favicon: asset(icon || '/favicon.ico') || undefined,
  };
}

export async function handleRequest(request: Request, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/link-preview') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
    const authorization = request.headers.get('authorization') || '';
    const apikey = request.headers.get('apikey') || '';
    if (!/^Bearer \S+$/.test(authorization) || !apikey || apikey.length > 2048) return json({ error: 'Sign in required' }, 401);
    const signal = AbortSignal.timeout(10000);
    try {
      const auth = await fetch(`${AUTH_ORIGIN}/auth/v1/user`, { headers: { authorization, apikey }, redirect: 'error', signal });
      if (!auth.ok) return json({ error: 'Sign in required' }, 401);
      const user = await auth.json() as { id?: string };
      if (!user.id) return json({ error: 'Sign in required' }, 401);
      if (!(await env.PREVIEW_RATE.limit({ key: `studygram-preview:${user.id}` })).success) return json({ error: 'Try again shortly' }, 429);
      if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Request too large' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Missing URL' }, 400);
      let body = ''; let size = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) return json({ error: 'Request too large' }, 413);
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } finally { await reader.cancel(); }
      const value = JSON.parse(body).url;
      if (typeof value !== 'string' || !publicPreviewUrl(value)) return json({ error: 'Public HTTPS links only' }, 400);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicPreviewUrl(value)!));
      const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      const cacheKey = new Request(`${new URL(request.url).origin}/__preview-cache/v1/${hash}`);
      const cache = (caches as unknown as { default: Cache }).default;
      const cached = await cache.match(cacheKey);
      if (cached) return json(await cached.json());
      const page = await fetchPage(value, signal);
      const preview = await extractPreview(await limitedHtml(page.response), page.url);
      // Resolve asset hosts too: untrusted HTML must not point thumbnails at local services.
      for (const key of ['image', 'favicon'] as const) {
        if (preview[key]) { try { await validateDestination(preview[key]!, signal); } catch { preview[key] = undefined; } }
      }
      ctx.waitUntil(cache.put(cacheKey, Response.json(preview, { headers: { 'Cache-Control': 'public, max-age=86400' } })));
      return json(preview);
    } catch { return json({ error: 'Preview unavailable' }, 422); }
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/link-preview') return env.ASSETS.fetch(request);
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403);
    const response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await handleRequest(request, env, ctx);
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey');
      response.headers.set('Access-Control-Max-Age', '600');
    }
    return response;
  },
};
