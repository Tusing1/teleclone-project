import { Radio, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SystemMessageProps {
  content: string;
  timestamp: string;
  callId?: string;
  hasActiveCall?: boolean;
  onJoinCall?: () => void;
  isChannel?: boolean;
}

export function SystemMessage({
  content,
  timestamp,
  callId,
  hasActiveCall,
  onJoinCall,
  isChannel = false
}: SystemMessageProps) {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isLiveStreamStarted = content.toLowerCase().includes('live stream started') || content.toLowerCase().includes('livestream started');
  const isLiveStreamEnded = content.toLowerCase().includes('live stream ended') || content.toLowerCase().includes('livestream ended');
  const isCallStarted = content.toLowerCase().includes('call started') || content.toLowerCase().includes('voice call started') || content.toLowerCase().includes('video call started');
  const isCallEnded = content.toLowerCase().includes('call ended');

  // Extract duration if present (e.g., "Live stream ended (1 hour)")
  const durationMatch = content.match(/\(([^)]+)\)/);
  const duration = durationMatch ? durationMatch[1] : null;

  // UNIFIED PILL STYLE for all system messages (Calls and Streams)
  const isStarted = isLiveStreamStarted || isCallStarted;
  const isEnded = isLiveStreamEnded || isCallEnded;
  const isMissed = content.toLowerCase().includes('missed');

  return (
    <div className="flex justify-center my-4 w-full">
      <div className={cn(
        "bg-black/40 backdrop-blur-sm text-white px-4 py-1.5 rounded-full flex items-center gap-2 text-sm shadow-sm border border-white/5 mx-auto max-w-[90%]",
        // Optional: differentiation based on state? For now, unified dark pill is cleaner.
      )}>
        {/* Icon Logic */}
        {isStarted ? (
          <div className={cn("w-2 h-2 rounded-full shrink-0", isChannel ? "bg-red-500 animate-pulse" : "bg-green-500 animate-pulse")} />
        ) : isMissed ? (
          <Phone className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
        )}

        {/* Content */}
        <span className="truncate opacity-90">{content}</span>

        {/* Join Button */}
        {hasActiveCall && onJoinCall && (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-3 ml-2 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white border-none rounded-full shadow-lg animate-pulse"
            onClick={onJoinCall}
          >
            JOIN
          </Button>
        )}
      </div>
    </div>
  );
}
