import { useState, useEffect } from 'react';
import { Download, Play, FileText, Image as ImageIcon, CheckCircle, Cloud } from 'lucide-react';
import { useFileCache } from '@/hooks/useFileCache';
import { PDFViewer } from './PDFViewer';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
  url: string;
  fileName: string;
  fileSize?: number;
  className?: string;
  variant?: 'compact' | 'full';
}

export function FilePreview({ 
  url, 
  fileName, 
  fileSize, 
  className,
  variant = 'full'
}: FilePreviewProps) {
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const { isFileCached, downloadAndCache } = useFileCache();

  useEffect(() => {
    checkCacheStatus();
  }, [url]);

  const checkCacheStatus = async () => {
    const cached = await isFileCached(url);
    setIsCached(cached);
  };

  const getFileExtension = () => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toUpperCase() || '';
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPDF = getFileExtension() === 'PDF';
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(url);
  const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(url);

  const handleClick = async () => {
    if (isPDF) {
      setShowPdfViewer(true);
    } else if (isImage || isVideo) {
      // For images and videos, open in new tab but also cache
      await downloadAndCache(url, fileName);
      window.open(url, '_blank');
    } else {
      // For other files, download
      const blob = await downloadAndCache(url, fileName);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  const getIcon = () => {
    if (isPDF) return <FileText className="w-6 h-6 text-red-400" />;
    if (isImage) return <ImageIcon className="w-6 h-6 text-blue-400" />;
    if (isVideo) return <Play className="w-6 h-6 text-purple-400" />;
    if (isAudio) return <Play className="w-6 h-6 text-green-400" />;
    return <Download className="w-6 h-6 text-slate-400" />;
  };

  const getBackgroundColor = () => {
    if (isPDF) return 'bg-red-500/20';
    if (isImage) return 'bg-blue-500/20';
    if (isVideo) return 'bg-purple-500/20';
    if (isAudio) return 'bg-green-500/20';
    return 'bg-slate-700/60';
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-left w-full",
            className
          )}
        >
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", getBackgroundColor())}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatFileSize(fileSize)} {getFileExtension()}</span>
              {isCached && (
                <span className="flex items-center gap-0.5 text-emerald-500">
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </button>
        {isPDF && (
          <PDFViewer
            open={showPdfViewer}
            onClose={() => setShowPdfViewer(false)}
            url={url}
            fileName={fileName}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-start gap-3 group cursor-pointer text-left",
          className
        )}
      >
        <div className={cn(
          "w-16 h-16 rounded-xl flex items-center justify-center shrink-0 group-hover:opacity-90 transition-opacity",
          getBackgroundColor()
        )}>
          {isPDF ? (
            <span className="text-red-400 font-bold text-sm">PDF</span>
          ) : (
            getIcon()
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="font-medium text-foreground truncate text-sm group-hover:text-primary transition-colors">
            {fileName || 'File'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {formatFileSize(fileSize)} {getFileExtension()}
            </span>
            {isCached ? (
              <span className="flex items-center gap-0.5 text-xs text-emerald-500">
                <CheckCircle className="w-3 h-3" />
                Saved locally
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs text-slate-500">
                <Cloud className="w-3 h-3" />
                Cloud
              </span>
            )}
          </div>
        </div>
      </button>
      {isPDF && (
        <PDFViewer
          open={showPdfViewer}
          onClose={() => setShowPdfViewer(false)}
          url={url}
          fileName={fileName}
        />
      )}
    </>
  );
}
