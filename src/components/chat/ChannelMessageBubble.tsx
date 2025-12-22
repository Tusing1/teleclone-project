import { useState } from 'react';
import { MessageWithSender, Profile } from '@/types/chat';
import { format } from 'date-fns';
import { Eye, Share2, Download, ChevronRight, Smile } from 'lucide-react';
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
  commentAvatars?: Profile[];
  canForward?: boolean;
}

const EMOJI_LIST = ['❤️', '👍', '👎', '😂', '😮', '😢', '🔥', '🎉'];

export function ChannelMessageBubble({
  message,
  reactions,
  onToggleReaction,
  onOpenComments,
  onForward,
  commentCount = 0,
  commentAvatars = [],
  canForward = false
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
            className="w-full max-h-80 object-cover cursor-pointer"
            onClick={() => window.open(message.file_url!, '_blank')}
          />
        </div>
      );
    }

    // File thumbnail with download icon - Telegram style
    return (
      <a
        href={message.file_url}
        download={message.file_name}
        className="flex items-start gap-3 mb-3 group"
      >
        <div className="w-16 h-16 bg-slate-700/60 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-slate-600/60 transition-colors">
          <Download className="w-7 h-7 text-slate-300" />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="font-medium text-foreground truncate text-sm">
            {message.file_name || 'File'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
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
        <div className="text-foreground whitespace-pre-wrap text-[15px] leading-relaxed">
          {parts.map((part, index) => {
            if (urlRegex.test(part)) {
              return (
                <a
                  key={index}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline break-all"
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
    <div className="max-w-[85%] md:max-w-[70%]">
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg">
        {/* File/Image Content */}
        {message.file_url && (
          <div className="p-3 pb-0">
            {renderFileThumbnail()}
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div className="px-4 py-3">
            {renderContent()}
          </div>
        )}

        {/* Reactions Row */}
        {(reactions.length > 0 || true) && (
          <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => onToggleReaction(reaction.emoji)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all ${
                  reaction.userReacted
                    ? 'bg-sky-500/30 text-sky-300 border border-sky-500/40'
                    : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="font-medium text-xs">{reaction.count}</span>
              </button>
            ))}
            
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 bg-slate-800 border-slate-700" align="start">
                <div className="flex gap-1 flex-wrap max-w-[200px]">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onToggleReaction(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-xl p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Footer Row - View count and time */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {((message.view_count || 0) / 1000).toFixed(1)}K
            </span>
            <span>{formatTime(message.created_at)}</span>
          </div>

          {/* Forward button - only for admins */}
          {canForward && onForward && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onForward}
              className="h-7 w-7 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Comments Section - Outside the bubble like Telegram */}
      {onOpenComments && (
        <button
          onClick={onOpenComments}
          className="flex items-center gap-2 mt-2 ml-1 group"
        >
          {/* Comment avatars */}
          {commentAvatars.length > 0 ? (
            <div className="flex -space-x-2">
              {commentAvatars.slice(0, 3).map((profile, index) => (
                <div
                  key={index}
                  className="w-6 h-6 rounded-full border-2 border-slate-900 overflow-hidden bg-slate-700"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-[10px] text-white font-medium">
                      {profile?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-gradient-to-br from-emerald-500 to-teal-600" />
              <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-gradient-to-br from-violet-500 to-purple-600" />
            </div>
          )}
          
          <span className="text-sm font-medium text-sky-400 group-hover:text-sky-300 transition-colors flex items-center gap-1">
            {commentCount > 0 ? `${commentCount} comments` : 'Leave a comment'}
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      )}
    </div>
  );
}
