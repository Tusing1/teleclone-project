import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}

export function PullToRefreshIndicator({ 
  pullDistance, 
  isRefreshing, 
  threshold 
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;
  
  if (!shouldShow) return null;

  return (
    <div 
      className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
      style={{ 
        top: Math.min(pullDistance - 40, threshold - 20),
        opacity: progress 
      }}
    >
      <div className={cn(
        "w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center",
        isRefreshing && "animate-spin"
      )}>
        <RefreshCw 
          className={cn(
            "h-5 w-5 text-primary transition-transform",
            !isRefreshing && "duration-200"
          )}
          style={{ 
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)` 
          }}
        />
      </div>
    </div>
  );
}
