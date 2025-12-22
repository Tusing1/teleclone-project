import { useState } from 'react';
import { MessageWithSender } from '@/types/chat';
import { format } from 'date-fns';
import { Eye, MessageCircle, Share2, Download, ChevronRight, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reaction } from '@/hooks/useReactions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ChannelMessageBubbleProps {
  message: MessageWithSender;
  reactions: Reaction[];
  onToggleReaction: (emoji: string) => void;
  onOpenComments?: () => void;
  onForward?: () => void;
  commentCount?: number;
  commentAvatars?: string[];
}

const EMOJI_LIST = ['❤️', '👍', '👎', '😂', '😮', '😢', '🔥', '🎉'];

export function ChannelMessageBubble({
  message,
  reactions,
  onToggleReaction,
  onOpenComments,
  onForward,
  commentCount = 0,
  commentAvatars = []
}: ChannelMessageBubbleProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileExtension = (fileName: string | null) => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toUpperCase() || '';
  };

  const isImageFile = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const renderFileThumbnail = () => {
    if (!message.file_url) return null;

    if (message.message_type === 'image' || isImageFile(message.file_url)) {
      return (
        <div className="relative rounded-xl overflow-hidden mb-3">
          <img
            src={message.file_url}
            alt={message.file_name || 'Image'}
            className="max-w-full max-h-80 object-cover cursor-pointer"
            onClick={() => window.open(message.file_url!, '_blank')}
          />
        </div>
      );
    }

    // File thumbnail with download icon
    return (
      <a
        href={message.file_url}
        download={message.file_name}
        className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl mb-3 hover:bg-accent/50 transition-colors"
      >
        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <Download className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {message.file_name || 'File'}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(message.file_size)} {getFileExtension(message.file_name)}
          </p>
        </div>
      </a>
    );
  };

  const renderContent = () => {
    if (message.content) {
      // Parse links in content
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = message.content.split(urlRegex);
      
      return (
        <div className="text-foreground whitespace-pre-wrap">
          {parts.map((part, index) => {
            if (urlRegex.test(part)) {
              return (
                <a
                  key={index}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {part}
                </a>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-border/30">
      {/* File/Image Content */}
      {renderFileThumbnail()}

      {/* Text Content */}
      {renderContent()}

      {/* Reactions Row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => onToggleReaction(reaction.emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
              reaction.userReacted
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-accent/50 hover:bg-accent text-foreground'
            }`}
          >
            <span>{reaction.emoji}</span>
            <span className="font-medium">{reaction.count}</span>
          </button>
        ))}
        
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full hover:bg-accent"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1 flex-wrap max-w-[200px]">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggleReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="text-xl p-1 hover:bg-accent rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Footer Row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
        {/* View count and time */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {(message.view_count || 0).toLocaleString()}
          </span>
          <span>{formatTime(message.created_at)}</span>
        </div>

        {/* Comments and Share */}
        <div className="flex items-center gap-2">
          {onOpenComments && (
            <button
              onClick={onOpenComments}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              {commentAvatars.length > 0 && (
                <div className="flex -space-x-2">
                  {commentAvatars.slice(0, 3).map((avatar, index) => (
                    <div
                      key={index}
                      className="w-6 h-6 rounded-full border-2 border-card overflow-hidden"
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs text-primary">
                          ?
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-sm font-medium flex items-center gap-1">
                {commentCount} comments
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          )}
          
          {onForward && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onForward}
              className="h-8 w-8 rounded-full"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
