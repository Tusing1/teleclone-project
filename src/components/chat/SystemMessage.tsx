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
  const isCallMessage = content.toLowerCase().includes('call started') || content.toLowerCase().includes('voice call') || content.toLowerCase().includes('video call');

  // Extract duration if present (e.g., "Live stream ended (1 hour)")
  const durationMatch = content.match(/\(([^)]+)\)/);
  const duration = durationMatch ? durationMatch[1] : null;

  // Compact pill style for live stream messages
  if (isLiveStreamStarted || isLiveStreamEnded) {
    return (
      <div className="flex justify-center py-1.5 px-4">
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium",
          isLiveStreamStarted 
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
            : "bg-slate-600/50 text-slate-300 border border-slate-500/30"
        )}>
          <Radio className={cn(
            "w-3.5 h-3.5",
            isLiveStreamStarted && "animate-pulse"
          )} />
          <span>
            {isLiveStreamStarted ? 'Live stream started' : `Live stream ended${duration ? ` (${duration})` : ''}`}
          </span>
        </div>
      </div>
    );
  }

  // Default system message style for calls and other messages
  return (
    <div className="flex justify-center py-2 px-4">
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl max-w-md",
        isChannel 
          ? "bg-violet-500/20 border border-violet-500/30" 
          : "bg-primary/10 border border-primary/20"
      )}>
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isChannel ? "bg-violet-500" : "bg-primary"
        )}>
          {isCallMessage ? (
            <Phone className="w-4 h-4 text-white" />
          ) : (
            <Radio className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            isChannel ? "text-violet-100" : "text-foreground"
          )}>
            {content}
          </p>
          <p className={cn(
            "text-xs",
            isChannel ? "text-violet-300/70" : "text-muted-foreground"
          )}>
            {formatTime(timestamp)}
          </p>
        </div>

        {/* Join button */}
        {hasActiveCall && onJoinCall && (
          <Button
            size="sm"
            onClick={onJoinCall}
            className={cn(
              "shrink-0",
              isChannel 
                ? "bg-violet-500 hover:bg-violet-600 text-white" 
                : "bg-primary hover:bg-primary/90"
            )}
          >
            Join
          </Button>
        )}
      </div>
    </div>
  );
}
