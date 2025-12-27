import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, X, Loader2, CheckCircle, Printer, RotateCw } from 'lucide-react';
import { useFileCache } from '@/hooks/useFileCache';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
}

export function PDFViewer({ open, onClose, url, fileName }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [rotation, setRotation] = useState(0);
  const { downloadAndCache, isFileCached } = useFileCache();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (open && url) {
      loadPDF();
    }
  }, [open, url]);

  // Handle intersection observer to update current page number while scrolling
  useEffect(() => {
    if (!open || numPages === 0) return;

    const options = {
      root: containerRef.current,
      threshold: 0.2, // Trigger when 20% of the page is visible
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageIndex = pageRefs.current.indexOf(entry.target as HTMLDivElement);
          if (pageIndex !== -1) {
            setCurrentPage(pageIndex + 1);
          }
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);

    // Using a timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      pageRefs.current.forEach((ref) => {
        if (ref) observer.observe(ref);
      });
    }, 500);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [open, numPages, scale]);

  const loadPDF = async () => {
    setLoading(true);
    const cached = await isFileCached(url);
    setIsCached(cached);

    const blob = await downloadAndCache(url, fileName);
    if (blob) {
      setPdfBlob(blob);
      setIsCached(true);
    }
    setLoading(false);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    pageRefs.current = new Array(numPages).fill(null);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  const handlePrint = () => {
    if (!pdfBlob) return;
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
        // Option to close window after print is triggered
        // printWindow.close(); 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      {/* max-w-none and h-screen make it full screen */}
      <DialogContent className="max-w-none w-screen h-screen flex flex-col p-0 gap-0 border-none rounded-none bg-[#1a1c1e] text-white">

        {/* Professional Toolbar */}
        <div className="h-14 flex items-center justify-between px-4 bg-[#202124] border-b border-white/10 shrink-0 z-50 shadow-md">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10">
              <X className="w-5 h-5" />
            </Button>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-sm font-medium truncate text-white/90">
                {fileName}
              </DialogTitle>
              <span className="text-[11px] text-white/50">
                {numPages > 0 ? `Page ${currentPage} of ${numPages}` : 'Loading...'}
              </span>
            </div>
            {isCached && (
              <span title="Saved locally" className="shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center bg-white/5 rounded-md p-0.5 border border-white/10 hidden sm:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="h-8 w-8 text-white/70 hover:text-white"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium w-12 text-center text-white/80">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                disabled={scale >= 3}
                className="h-8 w-8 text-white/70 hover:text-white"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <span title="Rotate">
              <Button
                variant="ghost"
                size="icon"
                onClick={rotate}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </span>

            <span title="Print">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrint}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Printer className="w-4 h-4" />
              </Button>
            </span>
          </div>
        </div>

        {/* PDF Scrolling Content Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent custom-scroll"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-white/50">Opening professional viewer...</p>
            </div>
          ) : pdfBlob ? (
            <div className="py-8 flex flex-col items-center gap-8 min-h-full">
              <Document
                file={pdfBlob}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-white/20" />
                  </div>
                }
                error={
                  <div className="text-center p-8 text-rose-400">
                    <p className="font-medium mb-4">This document couldn't be displayed</p>
                    <Button variant="outline" className="border-white/20 text-white" onClick={() => window.open(url, '_blank')}>
                      Open in browser
                    </Button>
                  </div>
                }
              >
                {Array.from(new Array(numPages), (_, index) => (
                  <div
                    key={`page_${index + 1}`}
                    ref={(el) => (pageRefs.current[index] = el)}
                    className="relative shadow-[0_0_25px_rgba(0,0,0,0.5)] bg-white transition-shadow duration-300"
                  >
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      rotate={rotation}
                      loading={
                        <div className="bg-white/5 flex items-center justify-center transition-all duration-300" style={{ width: 612 * scale, height: 792 * scale }}>
                          <Loader2 className="w-6 h-6 animate-spin text-white/10" />
                        </div>
                      }
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                    {/* Page Divider / Label for large docs */}
                    <div className="absolute -left-12 top-0 h-full flex flex-col items-center justify-center text-[10px] text-white/20 select-none hidden lg:flex">
                      <div className="w-px h-full bg-white/5" />
                      <span className="py-4 vertical-text">{index + 1}</span>
                      <div className="w-px h-full bg-white/5" />
                    </div>
                  </div>
                ))}
              </Document>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
              <p>Unable to load document</p>
              <Button variant="link" className="text-primary" onClick={() => window.open(url, '_blank')}>
                Open external link
              </Button>
            </div>
          )}
        </div>

        {/* CSS for vertical text and custom scroll */}
        <style>{`
          .vertical-text {
            writing-mode: vertical-rl;
            text-orientation: mixed;
          }
          .custom-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }
          .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          [data-state="open"] button[aria-label="Close"] {
            display: none;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
