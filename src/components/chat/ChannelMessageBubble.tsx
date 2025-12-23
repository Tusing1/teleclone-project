import { useState } from 'react';
import { MessageWithSender, Profile } from '@/types/chat';
import { format } from 'date-fns';
import { Eye, Share2, ChevronRight, Smile, MoreVertical, Reply, Link, Pin, Pencil, Trash2, Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reaction } from '@/hooks/useReactions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { FilePreview } from './FilePreview';
import { ChannelAudioPlayer } from './ChannelAudioPlayer';

interface ChannelMessageBubbleProps {
  message: MessageWithSender;
  reactions: Reaction[];
  onToggleReaction: (emoji: string) => void;
  onOpenComments?: () => void;
  onForward?: () => void;
  commentCount?: number;
  commentAvatars?: Profile[];
  canForward?: boolean;
  onReply?: () => void;
  onPin?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}

// Only positive emojis - removed 👎 and 😢
const EMOJI_LIST = ['❤️', '👍', '😂', '😮', '🔥', '🎉'];

export function ChannelMessageBubble({
  message,
  reactions,
  onToggleReaction,
  onOpenComments,
  onForward,
  commentCount = 0,
  commentAvatars = [],
  canForward = false,
  onReply,
  onPin,
  onEdit,
  onDelete,
  isAdmin = false
}: ChannelMessageBubbleProps) {
  const { user } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isOwn = message.sender_id === user?.id;

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

  const isVideoFile = (url: string | null, messageType?: string) => {
    if (!url) return false;
    // If explicitly marked as audio, it's not a video
    if (messageType === 'audio' || messageType === 'voice') return false;
    // webm can be audio or video - check message type first
    if (/\.webm$/i.test(url) && messageType === 'file') {
      // For webm, we need to determine if it's audio or video
      // If filename suggests audio (recording, stream, etc.) treat as audio
      return false;
    }
    return /\.(mp4|mov|avi|mkv|m4v)$/i.test(url);
  };

  const isAudioFile = (url: string | null, messageType?: string) => {
    if (!url) return false;
    // Explicit audio types
    if (messageType === 'audio' || messageType === 'voice') return true;
    // webm files from recordings are audio
    if (/\.webm$/i.test(url)) return true;
    return /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(url);
  };

  const copyMessageLink = () => {
    const link = `${window.location.origin}/message/${message.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const renderFileThumbnail = () => {
    if (!message.file_url) return null;

    // Image thumbnail
    if (message.message_type === 'image' || isImageFile(message.file_url)) {
      return (
        <div className="relative rounded-xl overflow-hidden mb-3">
          <img
            src={message.file_url}
            alt={message.file_name || 'Image'}
            className="w-full max-h-80 object-cover cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => window.open(message.file_url!, '_blank')}
          />
        </div>
      );
    }

    // Audio file with ChannelAudioPlayer (check audio first as webm can be both)
    if (isAudioFile(message.file_url, message.message_type)) {
      return (
        <ChannelAudioPlayer
          url={message.file_url}
          title={message.file_name?.replace(/\.[^/.]+$/, '') || message.content || 'Audio Recording'}
          className="mb-3"
        />
      );
    }

    // Video thumbnail with play button
    if (isVideoFile(message.file_url, message.message_type)) {
      return (
        <div 
          className="relative rounded-xl overflow-hidden mb-3 cursor-pointer group"
          onClick={() => window.open(message.file_url!, '_blank')}
        >
          <video
            src={message.file_url}
            className="w-full max-h-80 object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 rounded-full bg-sky-500/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Play className="w-7 h-7 text-white ml-1" fill="white" />
            </div>
          </div>
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-white text-xs font-medium">
            Video
          </div>
          <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-sky-500/90 flex items-center justify-center">
            <Download className="w-4 h-4 text-white" />
          </div>
        </div>
      );
    }

    // PDF and document files - use FilePreview with caching
    return (
      <FilePreview
        url={message.file_url}
        fileName={message.file_name || 'File'}
        fileSize={message.file_size || undefined}
        className="mb-3"
      />
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
    <div className="max-w-[85%] md:max-w-[70%] group relative">
      {/* More options button - 3 dots */}
      <div className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-slate-700">
            <DropdownMenuItem onClick={onReply} className="gap-2 text-slate-200 focus:bg-slate-700 focus:text-slate-200">
              <Reply className="h-4 w-4" />
              Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyMessageLink} className="gap-2 text-slate-200 focus:bg-slate-700 focus:text-slate-200">
              <Link className="h-4 w-4" />
              Copy Link
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={onPin} className="gap-2 text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                <Pin className="h-4 w-4" />
                Pin
              </DropdownMenuItem>
            )}
            {(isOwn || isAdmin) && (
              <>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem onClick={onEdit} className="gap-2 text-slate-200 focus:bg-slate-700 focus:text-slate-200">
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-400 focus:bg-slate-700 focus:text-red-400">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg">
        {/* Header Row - View count, time, and forward button at top */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {((message.view_count || 0) / 1000).toFixed(1)}K
            </span>
            <span>{formatTime(message.created_at)}</span>
          </div>

          {/* Forward button - only for admins - moved to top */}
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
