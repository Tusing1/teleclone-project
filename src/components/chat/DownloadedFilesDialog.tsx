import { useEffect, useState } from 'react';
import { HardDrive, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FilePreview } from './FilePreview';
import { CachedFile, FILES_CHANGED, useFileCache } from '@/hooks/useFileCache';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function DownloadedFilesDialog({ onClose }: { onClose: () => void }) {
  const { getDownloadedFiles, clearFileCache } = useFileCache();
  const [removing, setRemoving] = useState<CachedFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [files, setFiles] = useState<CachedFile[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => { void getDownloadedFiles().then(rows => { if (active) { setFiles(rows); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); };
    refresh(); window.addEventListener(FILES_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(FILES_CHANGED, refresh); };
  }, [getDownloadedFiles]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="rounded-3xl max-h-[90dvh] flex flex-col">
    <DialogTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" />Downloaded</DialogTitle>
    <DialogDescription>Files saved inside StudyGram on this device, not in your gallery. Clearing app/browser data removes these copies.</DialogDescription>
    <div className="overflow-y-auto min-h-0 space-y-2">{loading ? <Loader2 className="animate-spin mx-auto my-8" /> : error ? <p className="text-sm text-destructive p-6">Could not read device storage. Reopen StudyGram or check available space.</p> : files.length ? files.map(file => <div key={file.url} className="flex items-center gap-2"><div className="flex-1 min-w-0"><DownloadedFile file={file} /></div><Button variant="ghost" size="icon" aria-label={`Remove offline copy of ${file.name}`} onClick={() => setRemoving(file)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div>) : <p className="text-sm text-muted-foreground p-6 text-center">Open a file and choose Save offline to keep it here.</p>}</div>
    <AlertDialog open={!!removing} onOpenChange={open => { if (!open && !deleting) setRemoving(null); }}><AlertDialogContent><AlertDialogTitle>Remove device copy?</AlertDialogTitle><AlertDialogDescription>{removing?.name} will need downloading again. The original message and cloud file stay intact.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Keep file</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={async event => {
      event.preventDefault(); if (!removing) return;
      setDeleting(true);
      try { await clearFileCache(removing.url); setRemoving(null); toast.success('Device copy removed. Original message unchanged.'); }
      catch { toast.error('Could not remove this device copy.'); }
      finally { setDeleting(false); }
    }}>{deleting ? 'Removing…' : 'Remove device copy'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </DialogContent></Dialog>;
}
function DownloadedFile({ file }: { file: CachedFile }) {
  return <FilePreview url={file.url} fileName={file.name} fileSize={file.size} variant="compact" />;
}
