import React from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallButtonProps {
  onStartCall: () => void;
  canStartCall: boolean;
  hasActiveCall: boolean;
  onJoinCall?: () => void;
  pending?: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({
  onStartCall,
  canStartCall,
  hasActiveCall,
  onJoinCall,
  pending = false
}) => {
  if (hasActiveCall && onJoinCall) {
    return (
      <Button
        variant="default"
        size="icon"
        aria-label="Join live audio session"
        title="Join live audio session"
        onClick={onJoinCall}
        disabled={pending}
        className="rounded-2xl bg-emerald-400/15 text-emerald-500 hover:bg-emerald-400/25"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
      </Button>
    );
  }

  if (!canStartCall) {
    return null;
  }

  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={onStartCall} title="Start voice call" aria-label="Start voice call" className="rounded-2xl">
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
    </Button>
  );
};
