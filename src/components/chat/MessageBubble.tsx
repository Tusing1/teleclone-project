import { useState, useMemo } from 'react';
import { MessageWithSender } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Download, FileIcon, Forward, MoreVertical, MessageCircle, Reply, Copy, Pin, Pencil, Trash2, Play } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FilePreview } from './FilePreview';
import { MediaViewer } from './MediaViewer';
import { AudioPlayer } from './AudioPlayer';
import { LinkPreview, extractUrls } from './LinkPreview';

interface MessageBubbleProps {
  message: MessageWithSender;
  showAvatar?: boolean;
  onForward?: (message: MessageWithSender) => void;
  isChannelMessage?: boolean;
  onOpenComments?: (messageId: string) => void;
  onReply?: (message: MessageWithSender) => void;
  onEdit?: (message: MessageWithSender) => void;
  onDelete?: (message: MessageWithSender) => void;
  onPin?: (message: MessageWithSender) => void;
  isAdmin?: boolean;
  discussionMode?: boolean;
  onOpenBrowser?: (url: string) => void;
}

export function MessageBubble({
  message,
  showAvatar,
  onForward,
  isChannelMessage,
  onOpenComments,
  onReply,
  onEdit,
  onDelete,
  onPin,
  isAdmin = false,
  discussionMode = false,
  onOpenBrowser
}: MessageBubbleProps) {
  const { user } = useAuth();
  const [mediaOpen, setMediaOpen] = useState(false);
  const isOwn = message.sender_id === user?.id;
  const visualMedia = !!message.file_url && (message.message_type === 'image' || /\.(mp4|mov|m4v)(\?|$)/i.test(message.file_url));
  const [showMenu, setShowMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Extract URLs from message content for link previews
  const urls = useMemo(() => {
    if (!message.content || message.message_type !== 'text') return [];
    return extractUrls(message.content);
  }, [message.content, message.message_type]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (fileName: string | null) => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toUpperCase() || '';
  };

  const isVideoFile = (url: string | null, messageType?: string) => {
    if (!url) return false;
    if (messageType === 'audio' || messageType === 'voice') return false;
    if (/\.webm$/i.test(url)) return false; // Treat webm as audio by default (recordings)
    return /\.(mp4|mov|avi|mkv|m4v)$/i.test(url);
  };

  const isAudioFile = (url: string | null, messageType?: string) => {
    if (!url) return false;
    if (messageType === 'audio' || messageType === 'voice') return true;
    if (/\.webm$/i.test(url)) return true;
    return /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(url);
  };

  const copyMessageLink = async () => {
    try {
      await navigator.clipboard.writeText(message.content || message.file_url || '');
      toast.success('Copied');
    } catch {
      toast.error('Could not copy. Please allow clipboard access.');
    }
  };

  const renderFileContent = () => {
    if (message.message_type === 'image' && message.file_url) {
      return (
        <button type="button" aria-label="Open image" className="block w-full" onClick={() => setMediaOpen(true)}>
          <img
            src={message.file_url}
            alt="Shared image"
            className="block w-full max-h-96 object-contain"
          />
        </button>
      );
    }

    // Audio file - check audio first as webm can be both
    if (message.file_url && isAudioFile(message.file_url, message.message_type)) {
      return (
        <AudioPlayer
          url={message.file_url}
          fileName={message.file_name || undefined}
          fileSize={message.file_size || undefined}
          variant="compact"
          className="mb-1"
        />
      );
    }

    // Video with thumbnail and play button
    if (message.file_url && isVideoFile(message.file_url, message.message_type)) {
      return (
        <div
          className="mb-1 relative rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setMediaOpen(true)}
        >
          <video
            src={message.file_url}
            className="max-w-full max-h-64 object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
            </div>
          </div>
        </div>
      );
    }

    // Regular file - use FilePreview with caching and PDF viewer
    if (message.message_type === 'file' && message.file_url) {
      return (
        <FilePreview
          url={message.file_url}
          fileName={message.file_name || 'File'}
          fileSize={message.file_size || undefined}
          variant="compact"
          className="mb-1"
        />
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'flex gap-1 px-3 py-1 animate-fade-in group',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => {
        if (!menuOpen) setShowMenu(false);
      }}
    >
      {mediaOpen && message.file_url && <MediaViewer open onClose={() => setMediaOpen(false)} url={message.file_url} fileName={message.file_name || 'Shared image.jpg'} />}
      {/* Action menu - placed on opposite side of bubble */}
      {isOwn && (
        <DropdownMenu open={menuOpen} onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setShowMenu(false);
        }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-all self-center shrink-0 hover:bg-white/10",
                showMenu || menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-2xl border-white/10 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl">
            {onReply && (
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={copyMessageLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy text
            </DropdownMenuItem>
            {onForward && (
              <DropdownMenuItem onClick={() => onForward(message)}>
                <Forward className="h-4 w-4 mr-2" />
                Forward
              </DropdownMenuItem>
            )}
            {isAdmin && onPin && (
              <DropdownMenuItem onClick={() => onPin(message)}>
                <Pin className="h-4 w-4 mr-2" />
                Pin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(message)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div
        className={cn(
          'min-w-0 max-w-[85%] relative',
          isOwn
            ? 'text-message-out-foreground'
            : 'text-message-in-foreground'
        )}
      >
        <div className={cn('rounded-[1.35rem] overflow-hidden', visualMedia ? 'p-0 border-0' : 'px-3 py-1.5', isOwn ? 'bg-[hsl(var(--message-out))] text-white rounded-br-lg' : 'bg-secondary text-foreground rounded-bl-lg')}>
        {renderFileContent()}

        {message.content && (
          <div className={cn("text-sm whitespace-pre-wrap break-words leading-snug text-left", visualMedia && "px-3 py-1.5")}>
            {message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
              if (part.match(/^https?:\/\//)) {
                return (
                  <a
                    key={i}
                    href={part}
                    onClick={(e) => {
                      if (onOpenBrowser) {
                        e.preventDefault();
                        onOpenBrowser(part);
                      }
                    }}
                    className="text-sky-400 hover:underline break-all"
                    target={onOpenBrowser ? undefined : "_blank"}
                    rel="noopener noreferrer"
                  >
                    {part}
                  </a>
                );
              }

              // Simple Markdown-lite transformation for formatted messages
              // Handle bold: **text**
              let text = part;
              const segments = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

              return segments.map((seg, idx) => {
                if (seg.startsWith('**') && seg.endsWith('**')) {
                  return <strong key={idx}>{seg.slice(2, -2)}</strong>;
                }
                if (seg.startsWith('*') && seg.endsWith('*')) {
                  return <em key={idx}>{seg.slice(1, -1)}</em>;
                }

                // Handle simple list items: "- text"
                if (seg.startsWith('- ')) {
                  return <div key={idx} className="pl-4 border-l-2 border-primary/20 bg-primary/5 my-1 py-1 rounded-r-md">
                    {seg}
                  </div>;
                }
                return seg;
              });
            })}
          </div>
        )}

        {/* Link previews */}
        {urls.length > 0 && (
          <div className="mt-2 space-y-2">
            {urls.slice(0, 2).map((url, idx) => (
              <LinkPreview
                key={idx}
                url={url}
                onOpenBrowser={onOpenBrowser}
              />
            ))}
          </div>
        )}

        {/* Comments section for channel messages */}
        {isChannelMessage && onOpenComments && (
          <button
            onClick={() => onOpenComments(message.id)}
            className={cn(
              'flex items-center gap-1.5 mt-2 pt-2 border-t w-full text-left',
              isOwn ? 'border-primary-foreground/20' : 'border-border'
            )}
          >
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">
              {message.commentCount ? `${message.commentCount} comment${message.commentCount !== 1 ? 's' : ''}` : 'Leave a comment'}
            </span>
          </button>
        )}
        </div>
        <div className={cn(
          'flex items-center justify-end gap-1 mt-0.5 px-1',
          'text-muted-foreground'
        )}>
          <span className="text-[10px]">{formatTime(message.created_at)}</span>
          {isOwn && (
            message.is_read ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )
          )}
        </div>

      </div>

      {/* Action menu for non-own messages - on the right */}
      {!isOwn && (
        <DropdownMenu open={menuOpen} onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setShowMenu(false);
        }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-all self-center shrink-0 hover:bg-white/10",
                showMenu || menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-white/10 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl">
            {onReply && (
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={copyMessageLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy text
            </DropdownMenuItem>
            {onForward && (
              <DropdownMenuItem onClick={() => onForward(message)}>
                <Forward className="h-4 w-4 mr-2" />
                Forward
              </DropdownMenuItem>
            )}
            {isAdmin && onPin && (
              <DropdownMenuItem onClick={() => onPin(message)}>
                <Pin className="h-4 w-4 mr-2" />
                Pin
              </DropdownMenuItem>
            )}
            {isAdmin && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
