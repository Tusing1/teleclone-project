import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FileText, Music2, Play } from 'lucide-react';
import { MediaViewer } from './MediaViewer';
import { mediaKind } from '@/lib/media';
import { cn } from '@/lib/utils';

const PDFThumbnail = lazy(() => import('./PDFThumbnail'));
export function FilePreview({ url, fileName, fileSize, className, variant = 'full' }: { url: string; fileName: string; fileSize?: number; className?: string; variant?: 'compact' | 'full' }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const kind = mediaKind(fileName, url);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [url]);
  const extension = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const size = !fileSize ? '' : fileSize < 1024 * 1024 ? `${Math.ceil(fileSize / 1024)} KB` : `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
  return <>
    <button ref={ref} onClick={() => setOpen(true)} aria-label={`Open ${fileName}`} className={cn('flex w-full min-w-0 items-center gap-3 rounded-2xl p-2 text-left hover:bg-primary/10 transition-colors', className)}>
      <div className={cn('relative shrink-0 overflow-hidden rounded-xl border border-border bg-secondary text-primary flex items-center justify-center', variant === 'compact' ? 'w-14 h-16' : 'w-[72px] h-20')}>
        {kind === 'image' ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" /> : kind === 'video' ? <><video src={url} preload="metadata" muted className="w-full h-full object-cover" /><Play className="absolute h-6 w-6" /></> : kind === 'audio' ? <Music2 className="h-7 w-7" /> : kind === 'pdf' && visible ? <Suspense fallback={<span className="text-xs font-bold">PDF</span>}><PDFThumbnail url={url} /></Suspense> : <div className="text-center"><FileText className="h-6 w-6 mx-auto mb-1" /><span className="text-[10px] font-bold">{extension.slice(0, 6)}</span></div>}
      </div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{fileName || 'Shared file'}</p><p className="mt-1 text-xs opacity-70">{extension} {size && `· ${size}`}</p><p className="mt-1 text-xs opacity-70">{kind === 'file' ? 'File details & offline save' : 'Tap to open'}</p></div>
    </button>
    {open && <MediaViewer open onClose={() => setOpen(false)} url={url} fileName={fileName} />}
  </>;
}
