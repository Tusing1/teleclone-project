import { Radio, Phone, Video } from 'lucide-react';
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

  const isLiveStreamMessage = content.toLowerCase().includes('live stream') || content.toLowerCase().includes('livestream');
  const isCallMessage = content.toLowerCase().includes('call started') || content.toLowerCase().includes('voice call') || content.toLowerCase().includes('video call');

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
          {isLiveStreamMessage ? (
            <Radio className="w-4 h-4 text-white" />
          ) : isCallMessage ? (
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