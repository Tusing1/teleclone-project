import { useState } from 'react';
import { MessageWithSender } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Download, FileIcon, Forward, MoreVertical, MessageCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface MessageBubbleProps {
  message: MessageWithSender;
  showAvatar?: boolean;
  onForward?: (message: MessageWithSender) => void;
  isChannelMessage?: boolean;
  onOpenComments?: (messageId: string) => void;
}

export function MessageBubble({ message, showAvatar, onForward, isChannelMessage, onOpenComments }: MessageBubbleProps) {
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

  return (
    <div
      className={cn(
        'flex gap-2 px-4 py-0.5 animate-fade-in group',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Action menu for forwarding */}
      {!isOwn && showMenu && onForward && (
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
            <DropdownMenuItem onClick={() => onForward(message)}>
              <Forward className="h-4 w-4 mr-2" />
              Forward to Saved Messages
            </DropdownMenuItem>
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
        {message.message_type === 'image' && message.file_url && (
          <div className="mb-1">
            <img
              src={message.file_url}
              alt="Shared image"
              className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90"
              onClick={() => window.open(message.file_url!, '_blank')}
            />
          </div>
        )}

        {message.message_type === 'file' && message.file_url && (
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
              isOwn ? 'bg-primary-foreground/20' : 'bg-primary/20'
            )}>
              <FileIcon className={cn(
                'w-5 h-5',
                isOwn ? 'text-primary-foreground' : 'text-primary'
              )} />
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
            <Download className={cn(
              'w-5 h-5',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )} />
          </a>
        )}

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
      {isOwn && showMenu && onForward && (
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
            <DropdownMenuItem onClick={() => onForward(message)}>
              <Forward className="h-4 w-4 mr-2" />
              Forward to Saved Messages
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}