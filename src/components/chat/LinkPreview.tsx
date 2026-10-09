import { useState, useEffect } from 'react';
import { ExternalLink, Globe, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractMessageUrls, safeWebUrl } from '@/lib/messageLinks';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
  onOpenBrowser?: (url: string) => void;
}

// Simple URL metadata extraction from known patterns
function extractMetadataFromUrl(url: string): Partial<LinkPreviewData> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.replace('www.', '');

  // YouTube
  if (hostname === 'youtube.com' || hostname === 'youtu.be') {
    const videoId = url.includes('youtu.be')
      ? url.split('/').pop()?.split('?')[0]
      : new URLSearchParams(urlObj.search).get('v');
    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return {
        siteName: 'YouTube',
        image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        favicon: 'https://www.youtube.com/favicon.ico',
      };
    }
  }

  // Twitter/X
  if (hostname === 'twitter.com' || hostname === 'x.com') {
    return {
      siteName: 'X (Twitter)',
      favicon: 'https://abs.twimg.com/favicons/twitter.ico',
    };
  }

  // GitHub
  if (hostname === 'github.com') {
    return {
      siteName: 'GitHub',
      favicon: 'https://github.com/favicon.ico',
    };
  }

  // LinkedIn
  if (hostname === 'linkedin.com') {
    return {
      siteName: 'LinkedIn',
      favicon: 'https://www.linkedin.com/favicon.ico',
    };
  }

  // Instagram
  if (hostname === 'instagram.com') {
    return {
      siteName: 'Instagram',
      favicon: 'https://www.instagram.com/favicon.ico',
    };
  }

  return {
    siteName: hostname.charAt(0).toUpperCase() + hostname.slice(1),
  };
}

export function LinkPreview({ url, className, onOpenBrowser }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      setError(false);
      setImageError(false);

      try {
        if (!safeWebUrl(url)) throw new Error('Unsupported link');
        const urlObj = new URL(url);
        const metadata = extractMetadataFromUrl(url);

        // For now, we use basic metadata extraction
        // A full implementation would use an edge function to fetch Open Graph data
        setPreview({
          url,
          title: urlObj.pathname.slice(1).split('/').join(' › ') || metadata.siteName,
          siteName: metadata.siteName,
          image: metadata.image,
          favicon: metadata.favicon,
        });
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-secondary/50 animate-pulse",
        className
      )}>
        <div className="w-10 h-10 rounded bg-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-secondary rounded w-3/4" />
          <div className="h-2 bg-secondary rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <a
      href={url}
      target={onOpenBrowser ? undefined : "_blank"}
      rel="noopener noreferrer"
      onClick={(e) => {
        if (onOpenBrowser) {
          e.preventDefault();
          onOpenBrowser(url);
        }
      }}
      className={cn(
        "block rounded-lg overflow-hidden border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors group",
        className
      )}
    >
      {/* Image preview for links with images */}
      {preview.image && !imageError && (
        <div className="relative aspect-video bg-secondary overflow-hidden">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex items-start gap-3">
        {/* Favicon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
          {preview.favicon ? (
            <img
              src={preview.favicon}
              alt=""
              className="w-6 h-6"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <Globe className={cn("w-5 h-5 text-muted-foreground", preview.favicon && "hidden")} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
            <span className="truncate">{preview.siteName}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </div>
          <p className="text-sm font-medium truncate">
            {preview.title || new URL(url).hostname}
          </p>
          {preview.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {preview.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

// Utility to detect URLs in text
export function extractUrls(text: string): string[] {
  return extractMessageUrls(text);
}
