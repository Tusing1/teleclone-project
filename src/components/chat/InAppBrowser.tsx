import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, RotateCw, Loader2, Globe } from 'lucide-react';
import { safeWebUrl } from '@/lib/messageLinks';

export function InAppBrowser({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const safeUrl = safeWebUrl(url);
  const parsed = safeUrl ? new URL(safeUrl) : null;
  // Do not embed our own authenticated origin in a scripts/same-origin sandbox.
  const embeddable = !!parsed && parsed.origin !== window.location.origin && !(window.location.protocol === 'https:' && parsed.protocol === 'http:');
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 8000);
    return () => window.clearTimeout(timer);
  }, [url, open, version]);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent aria-describedby={undefined} className="w-screen max-w-none h-[100dvh] flex flex-col p-0 gap-0 rounded-none border-0 bg-background [&>button]:hidden">
      <DialogTitle className="sr-only">StudyGram link viewer</DialogTitle>
      <header className="flex items-center gap-2 border-b border-border bg-card p-2 pt-[max(.5rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" aria-label="Return to conversation" onClick={onClose}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full bg-secondary px-3 py-2"><Globe className="h-4 w-4 shrink-0 text-sky-500" /><span className="truncate text-sm">{parsed?.hostname || 'Unsupported link'}</span></div>
        {embeddable && <Button variant="ghost" size="icon" aria-label="Reload link" onClick={() => setVersion(v => v + 1)}><RotateCw className="h-4 w-4" /></Button>}
        {safeUrl && <Button variant="ghost" size="icon" aria-label="Open in external browser" onClick={() => window.open(safeUrl, '_blank', 'noopener,noreferrer')}><ExternalLink className="h-4 w-4" /></Button>}
      </header>
      <div className="flex-1 min-h-0 relative">
        {embeddable ? <>
          {loading && <div role="status" className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-card shadow px-4 py-2 flex items-center gap-2 pointer-events-none"><Loader2 className="h-4 w-4 animate-spin" />Opening link…</div>}
          <iframe key={`${url}:${version}`} src={safeUrl!} title="Linked website" className="w-full h-full border-0 bg-white" onLoad={() => setLoading(false)} sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer" />
        </> : <div className="p-6 flex h-full flex-col items-center justify-center gap-4 text-center">
          <Globe className="h-10 w-10 text-sky-500" />
          <h3 className="font-semibold">{parsed?.protocol === 'http:' ? 'This website uses an insecure connection' : 'Open this page separately'}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{safeUrl ? parsed?.protocol === 'http:' ? 'An HTTPS app cannot display an HTTP page inside it. You can open it in your browser without closing this conversation.' : 'This page cannot safely run inside StudyGram. Your conversation will stay here while you view it in your browser.' : 'Only web links without embedded credentials can be opened.'}</p>
          {safeUrl && <Button onClick={() => window.open(safeUrl, '_blank', 'noopener,noreferrer')}><ExternalLink className="h-4 w-4 mr-2" />Open in browser</Button>}
        </div>}
      </div>
      {embeddable && <div className="border-t border-border bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] flex items-center gap-3"><p className="flex-1 text-xs text-muted-foreground">Blank page? This website may not allow embedded viewing. Your conversation stays open.</p><Button size="sm" variant="secondary" onClick={() => window.open(safeUrl!, '_blank', 'noopener,noreferrer')}>Open in browser</Button></div>}
    </DialogContent>
  </Dialog>;
}
