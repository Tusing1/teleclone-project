import { useState, useMemo } from 'react';
import { MessageWithSender } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Download, FileIcon, Forward, MoreVertical, MessageCircle, Reply, Link, Pin, Pencil, Trash2, Play } from 'lucide-react';
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
  const isOwn = message.sender_id === user?.id;
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

  const copyMessageLink = () => {
    const link = `${window.location.origin}/message/${message.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const renderFileContent = () => {
    if (message.message_type === 'image' && message.file_url) {
      return (
        <div className="mb-1">
          <img
            src={message.file_url}
            alt="Shared image"
            className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90"
            onClick={() => window.open(message.file_url!, '_blank')}
          />
        </div>
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
          onClick={() => window.open(message.file_url!, '_blank')}
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
        'flex gap-1.5 px-2 py-0.5 animate-fade-in group',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => {
        if (!menuOpen) setShowMenu(false);
      }}
    >
      {/* Action menu for non-own messages */}
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
                "h-7 w-7 transition-opacity self-center",
                showMenu || menuOpen ? "opacity-100" : "opacity-0"
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {onReply && (
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={copyMessageLink}>
              <Link className="h-4 w-4 mr-2" />
              Copy Link
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

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 shadow-sm relative',
          isOwn
            ? 'bg-message-out text-message-out-foreground rounded-tr-sm'
            : 'bg-message-in text-message-in-foreground rounded-tl-sm'
        )}
      >
        {renderFileContent()}

        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
              return part;
            })}
          </p>
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

        <div className={cn(
          'flex items-center justify-end gap-1 mt-0.5',
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
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

      {/* Action menu for own messages */}
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
                "h-7 w-7 transition-opacity self-center",
                showMenu || menuOpen ? "opacity-100" : "opacity-0"
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {onReply && (
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={copyMessageLink}>
              <Link className="h-4 w-4 mr-2" />
              Copy Link
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
    </div>
  );
}
