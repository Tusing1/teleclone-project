import { safeWebUrl } from './messageLinks';

export const STUDYGRAM_HOSTS = ['studdybuddyapp.com', 'www.studdybuddyapp.com'];

// Only known application routes are internal. Downloads and unknown paths stay links.
export function internalAppPath(value: string, origin: string): string | null {
  const safe = safeWebUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.origin !== origin && !(STUDYGRAM_HOSTS.includes(url.hostname) && !url.port)) return null;
  if (!/^\/(?:auth|install|help|privacy)?\/?$/.test(url.pathname) && !/^\/invite\/[^/]+\/?$/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function publicPreviewUrl(value: string): string | null {
  const safe = safeWebUrl(value);
  if (!safe || safe.length > 2048) return null;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || !host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host)) return null;
  if (/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)) return null;
  for (const key of url.searchParams.keys()) {
    if (/token|secret|password|credential|signature|api.?key|^code$|^auth$/i.test(key)) return null;
  }
  url.hash = '';
  return url.href;
}

// Conservative global-unicast allowlist; ambiguous/special address ranges fail closed.
export function isPublicAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const first = parseInt(ip.split(':')[0], 16);
    return first >= 0x2000 && first < 0x4000 && !/^2001:(?!4860:)/i.test(ip) && !/^2002:/i.test(ip);
  }
  const pieces = ip.split('.');
  if (pieces.length !== 4 || pieces.some(piece => !/^\d{1,3}$/.test(piece) || Number(piece) > 255)) return false;
  const [a, b, c] = pieces.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
