import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useFileCache } from '@/hooks/useFileCache';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { toast } from 'sonner';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

function ScrollPage({ number, width, rotation, root, onVisible }: { number: number; width: number; rotation: number; root: HTMLElement | null; onVisible: (page: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(number === 1);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    if (!root || !ref.current) return;
    const preload = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { root, rootMargin: '800px 0px' });
    const visible = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onVisible(number); }, { root, rootMargin: '0px 0px -65% 0px' });
    preload.observe(ref.current); visible.observe(ref.current);
    return () => { preload.disconnect(); visible.disconnect(); };
  }, [root, number, onVisible]);
  const height = width * (rotation % 180 ? 1 / ratio : ratio);
  return <div ref={ref} aria-label={`Page ${number}`} className="mx-auto mb-4 bg-white shadow-xl" style={{ width, minHeight: height }}>
    {nearby ? <Page pageNumber={number} width={width} rotate={rotation} onLoadSuccess={page => { const viewport = page.getViewport({ scale: 1 }); setRatio(viewport.height / viewport.width); }} loading={<div style={{ height }} className="flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>} /> : <div style={{ height }} />}
  </div>;
}

export function PDFViewer({ open, onClose, url, fileName }: { open: boolean; onClose: () => void; url: string; fileName: string }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState(340);
  const [file, setFile] = useState<string | Blob | null>(null);
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { getCachedFile, saveOffline } = useFileCache();
  const savedOffline = useOfflineStatus(url);
  usePinchZoom(container, zoom, setZoom);
  useEffect(() => {
    let active = true;
    setFile(null); setPage(1); setNumPages(0); setZoom(1); setRotation(0);
    // Choose one source before mounting; switching a loaded source destroys
    // its worker while newly visible pages may still request that document.
    void getCachedFile(url).then(cached => { if (active) setFile(cached?.blob || url); }).catch(() => { if (active) setFile(url); });
    return () => { active = false; };
  }, [url, getCachedFile]);
  useEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, Math.min(900, entries[0].contentRect.width - 32))));
    observer.observe(container);
    return () => observer.disconnect();
  }, [open, container]);
  const download = async () => {
    if (url.startsWith('blob:')) { toast.info('This PDF is already opened from device storage.'); return; }
    setDownloading(true);
    try {
      await saveOffline(url, fileName);
      toast.success('Saved offline in StudyGram · Downloaded');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save offline.'); }
    finally { setDownloading(false); }
  };
  return <Dialog open={open} onOpenChange={onClose}>
    <DialogContent aria-describedby={undefined} className="w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-0 gap-0 flex flex-col bg-background [&>button]:top-3">
      <header className="min-h-16 flex items-center gap-2 border-b border-border bg-card px-4 pr-20">
        <DialogTitle className="flex-1 min-w-0 truncate text-base">{fileName}</DialogTitle>
        {!savedOffline && !url.startsWith('blob:') && <Button variant="ghost" size="icon" aria-label="Save PDF offline" onClick={download} disabled={downloading}>{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</Button>}
      </header>
      <div ref={setContainer} className="flex-1 min-h-0 overflow-auto scrollbar-thin p-4">
        {file ? <Document key={retry} file={file} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<div role="status" className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>} error={<div className="text-center p-6 space-y-3"><p>Unable to display this PDF.</p><Button variant="secondary" onClick={() => setRetry(r => r + 1)}>Retry</Button>{!savedOffline && !url.startsWith('blob:') && <Button onClick={download}>Save PDF offline</Button>}</div>}>
          {Array.from({ length: numPages }, (_, index) => <ScrollPage key={index + 1} number={index + 1} width={width * zoom} rotation={rotation} root={container} onVisible={setPage} />)}
        </Document> : <div role="status" className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>}
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-card p-3">
        <span className="min-w-20 text-center text-sm">{numPages ? `${page} / ${numPages}` : 'Loading…'}</span>
        <span className="text-xs text-muted-foreground sm:hidden">Pinch to zoom · {Math.round(zoom * 100)}%</span>
        <Button className="hidden sm:inline-flex" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - .25))}><ZoomOut className="h-5 w-5" /></Button>
        <Button className="hidden sm:inline-flex" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z + .25))}><ZoomIn className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon" aria-label="Rotate PDF" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw className="h-5 w-5" /></Button>
      </footer>
    </DialogContent>
  </Dialog>;
}
