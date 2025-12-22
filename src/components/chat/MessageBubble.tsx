import { useState } from 'react';
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
  isAdmin = false
}: MessageBubbleProps) {
  const { user } = useAuth();
  const isOwn = message.sender_id === user?.id;
  const [showMenu, setShowMenu] = useState(false);

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

  const isVideoFile = (url: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(url);
  };

  const isAudioFile = (url: string | null) => {
    if (!url) return false;
    return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(url);
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

    // Video with thumbnail and play button
    if (message.file_url && isVideoFile(message.file_url)) {
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

    // Audio file
    if (message.file_url && isAudioFile(message.file_url)) {
      return (
        <div 
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg mb-1 cursor-pointer group',
            isOwn ? 'bg-primary-foreground/10' : 'bg-muted'
          )}
          onClick={() => window.open(message.file_url!, '_blank')}
        >
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform',
            isOwn ? 'bg-primary-foreground/20' : 'bg-primary/80'
          )}>
            <Play className={cn(
              'w-5 h-5 ml-0.5',
              isOwn ? 'text-primary-foreground' : 'text-white'
            )} fill={isOwn ? 'currentColor' : 'white'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{message.file_name}</p>
            <p className={cn(
              'text-xs',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {message.file_size && formatFileSize(message.file_size)}
            </p>
          </div>
        </div>
      );
    }

    // Regular file
    if (message.message_type === 'file' && message.file_url) {
      const ext = getFileExtension(message.file_name);
      const isPDF = ext === 'PDF';

      return (
        <a
          href={message.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg mb-1',
            isOwn ? 'bg-primary-foreground/10' : 'bg-muted'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            isPDF ? 'bg-red-500/20' : isOwn ? 'bg-primary-foreground/20' : 'bg-primary/20'
          )}>
            {isPDF ? (
              <span className="text-red-500 font-bold text-xs">PDF</span>
            ) : (
              <FileIcon className={cn(
                'w-5 h-5',
                isOwn ? 'text-primary-foreground' : 'text-primary'
              )} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{message.file_name}</p>
            <p className={cn(
              'text-xs',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {message.file_size && formatFileSize(message.file_size)} {ext}
            </p>
          </div>
          <Download className={cn(
            'w-5 h-5',
            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )} />
        </a>
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'flex gap-2 px-4 py-0.5 animate-fade-in group',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Action menu for non-own messages */}
      {!isOwn && showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity self-center"
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
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-3 py-2 shadow-sm relative',
          isOwn 
            ? 'bg-message-out text-message-out-foreground rounded-tr-sm' 
            : 'bg-message-in text-message-in-foreground rounded-tl-sm'
        )}
      >
        {renderFileContent()}

        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
      {isOwn && showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity self-center"
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
