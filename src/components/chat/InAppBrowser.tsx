import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, RotateCw, Loader2, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InAppBrowserProps {
    open: boolean;
    onClose: () => void;
    url: string;
}

export function InAppBrowser({ open, onClose, url }: InAppBrowserProps) {
    const [loading, setLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState(0);

    useEffect(() => {
        if (open) {
            setLoading(true);
        }
    }, [open, url]);

    const handleRefresh = () => {
        setIframeKey(prev => prev + 1);
        setLoading(true);
    };

    const handleOpenExternal = () => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Extract hostname for cleaner display
    const getDisplayUrl = (urlStr: string) => {
        try {
            const urlObj = new URL(urlStr);
            return urlObj.hostname;
        } catch (e) {
            return urlStr;
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-none w-screen h-screen flex flex-col p-0 gap-0 border-none rounded-none bg-[#1a1c1e] text-white">

                {/* Browser Toolbar */}
                <div className="h-14 flex items-center justify-between px-4 bg-[#202124] border-b border-white/10 shrink-0 z-50 shadow-md">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10">
                            <X className="w-5 h-5" />
                        </Button>

                        <div className="flex items-center gap-1 hidden sm:flex">
                            <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-white/30">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-white/30">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-full border border-white/10 min-w-0 max-w-[200px] sm:max-w-md">
                            <Globe className="w-3.5 h-3.5 text-white/40 shrink-0" />
                            <span className="text-xs text-white/60 truncate font-mono">
                                {getDisplayUrl(url)}
                            </span>
                            {loading && <Loader2 className="w-3 h-3 animate-spin text-white/40 shrink-0" />}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRefresh}
                            className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9"
                            title="Refresh"
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleOpenExternal}
                            className="bg-sky-600 hover:bg-sky-700 text-white gap-2 h-9"
                        >
                            <span className="hidden sm:inline">Open in Browser</span>
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Browser Content Area */}
                <div className="flex-1 bg-white relative">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                            <Loader2 className="w-10 h-10 animate-spin text-sky-500 mb-4" />
                            <p className="text-slate-400 text-sm animate-pulse font-medium">Loading secure content...</p>

                            {/* Fallback hint if it takes too long */}
                            <div className="mt-8 p-4 max-w-xs text-center border border-white/5 rounded-lg bg-white/5">
                                <p className="text-xs text-slate-500 mb-3">
                                    Some sites block in-app viewing for security. If it doesn't load, use the button above.
                                </p>
                            </div>
                        </div>
                    )}

                    <iframe
                        key={iframeKey}
                        src={url}
                        className="w-full h-full border-none"
                        onLoad={() => setLoading(false)}
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        title="In-App Browser"
                    />
                </div>

                {/* Hide Dialog close button */}
                <style>{`
          [data-state="open"] button[aria-label="Close"] {
            display: none;
          }
        `}</style>
            </DialogContent>
        </Dialog>
    );
}
