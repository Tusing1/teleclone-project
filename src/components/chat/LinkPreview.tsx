import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractMessageUrls } from '@/lib/messageLinks';
import { basicLinkPreview, loadLinkPreview } from '@/lib/linkPreview';
import { useAuth } from '@/hooks/useAuth';

export function LinkPreview({ url, className, onOpenBrowser }: { url: string; className?: string; onOpenBrowser?: (url: string) => void }) {
  const { user } = useAuth();
  const [preview, setPreview] = useState(() => basicLinkPreview(url));
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    let active = true;
    setPreview(basicLinkPreview(url)); setImageError(false); setFaviconError(false);
    // Only request metadata near the viewport, never for the entire chat history.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void loadLinkPreview(url).then(data => { if (active) setPreview(data); }).catch(() => {});
      }
    }, { rootMargin: '100px' });
    if (anchor.current) observer.observe(anchor.current);
    return () => { active = false; observer.disconnect(); };
  }, [url, user?.id]);
  useEffect(() => { setImageError(false); setFaviconError(false); }, [preview?.image, preview?.favicon]);
  if (!preview) return null;
  return <a ref={anchor} href={preview.url} target={onOpenBrowser ? undefined : '_blank'} rel="noopener noreferrer"
    onClick={event => { if (onOpenBrowser) { event.preventDefault(); onOpenBrowser(url); } }}
    className={cn('block overflow-hidden rounded-2xl border border-border/40 bg-secondary/30 transition-colors hover:bg-secondary/50 group', className)}>
    {preview.image && !imageError && <div className="relative aspect-[1.91/1] bg-secondary/50 overflow-hidden">
      <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn('w-full h-full transition-transform duration-300 group-hover:scale-[1.02]', preview.siteName === 'StudyGram' ? 'object-contain p-5' : 'object-cover')} onError={() => setImageError(true)} />
    </div>}
    <div className="p-3 flex items-start gap-3">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-secondary flex items-center justify-center overflow-hidden">
        {preview.favicon && !faviconError ? <img src={preview.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-5 h-5 object-contain" onError={() => setFaviconError(true)} /> : <Globe className="w-5 h-5 text-sky-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-sky-500 mb-1"><span className="truncate">{preview.siteName}</span><ExternalLink className="w-3 h-3 shrink-0" /></div>
        <p className="text-sm font-medium line-clamp-2">{preview.title}</p>
        {preview.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{preview.description}</p>}
      </div>
    </div>
  </a>;
}
export function extractUrls(text: string): string[] { return extractMessageUrls(text); }
