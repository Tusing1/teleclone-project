import { lazy, Suspense, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { mediaKind } from '@/lib/media';
import { useFileCache } from '@/hooks/useFileCache';
import { toast } from 'sonner';

const PDFViewer = lazy(() => import('./PDFViewer').then(m => ({ default: m.PDFViewer })));

export function MediaViewer({ open, onClose, url, fileName }: { open: boolean; onClose: () => void; url: string; fileName: string }) {
  const kind = mediaKind(fileName, url);
  const [zoom, setZoom] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { saveOffline, getCachedFile } = useFileCache();
  const [displayUrl, setDisplayUrl] = useState(url);
  useEffect(() => {
    let active = true; let objectUrl: string | undefined;
    setDisplayUrl(url);
    void getCachedFile(url).then(cached => { if (active && cached) { objectUrl = URL.createObjectURL(cached.blob); setDisplayUrl(objectUrl); } });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, getCachedFile]);
  useEffect(() => {
    setZoom(1); setControlsVisible(true); setText(null); setError(false);
    if (!open || kind !== 'text') return;
    const controller = new AbortController();
    fetch(displayUrl, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unable to open file');
      const blob = await response.blob();
      if (blob.size > 2 * 1024 * 1024) throw new Error('Text file too large for preview');
      setText(await blob.text());
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, displayUrl, kind]);
  const download = async () => {
    setDownloading(true);
    try {
      if (!url.startsWith('blob:')) await saveOffline(url, fileName);
      toast.success('Saved offline in StudyGram · Downloaded');
    } catch { toast.error('Could not save this file offline. Try again.'); }
    finally { setDownloading(false); }
  };
  if (!open) return null;
  if (kind === 'pdf') return <Suspense fallback={<div role="status" className="fixed inset-0 z-[100] bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}><PDFViewer open onClose={onClose} url={url} fileName={fileName} /></Suspense>;
  if (kind === 'image') return <Dialog open onOpenChange={onClose}>
    <DialogContent aria-describedby={undefined} className="w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 p-0 gap-0 bg-black text-white [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:p-2">
      <DialogTitle className="sr-only">Image viewer</DialogTitle>
      <div className="absolute inset-0 overflow-auto flex" onClick={() => setControlsVisible(v => !v)}>
        {error ? <p className="m-auto px-6">Unable to display this image. Use Save offline.</p> : <img src={displayUrl} alt={fileName} onError={() => setError(true)} className="m-auto object-contain" style={{ width: zoom > 1 ? `${zoom * 100}%` : '100%', maxWidth: zoom > 1 ? 'none' : '100%', maxHeight: zoom === 1 ? '100%' : 'none', flexShrink: 0 }} />}
      </div>
      <div className={`absolute top-0 left-0 right-14 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity ${controlsVisible || error ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'}`}>
        <Button variant="ghost" size="icon" aria-label="Save image offline" onClick={download} disabled={downloading}>{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</Button>
      </div>
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/65 backdrop-blur-xl p-2 transition-opacity ${controlsVisible ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'}`}>
        <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(z => Math.max(1, z - .5))}><ZoomOut className="h-5 w-5" /></Button><span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoom === 3} onClick={() => setZoom(z => Math.min(3, z + .5))}><ZoomIn className="h-5 w-5" /></Button>
      </div>
    </DialogContent>
  </Dialog>;
  return <Dialog open onOpenChange={onClose}>
    <DialogContent className="w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-0 gap-0 flex flex-col bg-background [&>button]:top-3">
      <header className="min-h-16 flex items-center gap-2 border-b border-border bg-card px-4 pr-20">
        <DialogTitle className="flex-1 min-w-0 truncate text-base">{fileName}</DialogTitle>
        <Button variant="ghost" size="icon" aria-label="Save offline" onClick={download} disabled={downloading}>{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</Button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin flex items-center justify-center p-4">
        {error ? <p className="text-muted-foreground">Preview unavailable. You can save this file offline.</p> : kind === 'video' ? <video src={displayUrl} controls playsInline onError={() => setError(true)} className="max-h-full max-w-full rounded-2xl" /> : kind === 'audio' ? <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6"><div className="mb-6 h-24 rounded-2xl bg-primary/15 flex items-center justify-center text-primary text-4xl">♫</div><AudioPlayer url={url} fileName={fileName} /></div> : kind === 'text' ? text === null ? <Loader2 className="animate-spin" /> : <pre className="self-start w-full whitespace-pre-wrap break-words text-sm font-mono">{text}</pre> : <div className="text-center space-y-4"><FileText className="h-16 w-16 text-primary mx-auto" /><p>This format doesn’t support an in-app preview yet.</p><Button onClick={download} disabled={downloading}>Save offline</Button></div>}
      </div>
    </DialogContent>
  </Dialog>;
}
