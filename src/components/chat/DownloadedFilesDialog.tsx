import { useEffect, useState } from 'react';
import { HardDrive, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FilePreview } from './FilePreview';
import { CachedFile, FILES_CHANGED, useFileCache } from '@/hooks/useFileCache';

export function DownloadedFilesDialog({ onClose }: { onClose: () => void }) {
  const { getDownloadedFiles } = useFileCache();
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
    <div className="overflow-y-auto min-h-0 space-y-2">{loading ? <Loader2 className="animate-spin mx-auto my-8" /> : error ? <p className="text-sm text-destructive p-6">Could not read device storage. Reopen StudyGram or check available space.</p> : files.length ? files.map(file => <DownloadedFile key={file.url} file={file} />) : <p className="text-sm text-muted-foreground p-6 text-center">Open a file and choose Save offline to keep it here.</p>}</div>
  </DialogContent></Dialog>;
}
function DownloadedFile({ file }: { file: CachedFile }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const objectUrl = URL.createObjectURL(file.blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file.blob]);
  return url ? <FilePreview url={url} fileName={file.name} fileSize={file.size} variant="compact" /> : null;
}
