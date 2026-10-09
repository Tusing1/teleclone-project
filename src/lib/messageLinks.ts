export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function extractMessageUrls(text: string): string[] {
  const candidates = text.match(/https?:\/\/[^\s<>]+/gi) || [];
  return [...new Set(candidates.map(value => value.replace(/[.,;:!?"')\]}]+$/, '')).filter(value => safeWebUrl(value)))];
}
export function splitMessageLinks(text: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    const start = match.index!;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    const clean = match[0].replace(/[.,;:!?"')\]}]+$/, '');
    const url = safeWebUrl(clean);
    if (url) {
      parts.push({ text: clean, url });
      if (clean.length < match[0].length) parts.push({ text: match[0].slice(clean.length) });
    } else parts.push({ text: match[0] });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
