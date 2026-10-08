import React from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallButtonProps {
  onStartCall: () => void;
  canStartCall: boolean;
  hasActiveCall: boolean;
  onJoinCall?: () => void;
}

export const CallButton: React.FC<CallButtonProps> = ({
  onStartCall,
  canStartCall,
  hasActiveCall,
  onJoinCall
}) => {
  if (hasActiveCall && onJoinCall) {
    return (
      <Button
        variant="default"
        size="icon"
        aria-label="Join live audio session"
        title="Join live audio session"
        onClick={onJoinCall}
        className="bg-green-500 hover:bg-green-600 animate-pulse"
      >
        <Phone className="h-5 w-5" />
      </Button>
    );
  }

  if (!canStartCall) {
    return null;
  }

  return (
    <Button variant="ghost" size="icon" onClick={onStartCall} title="Voice Call">
      <Phone className="h-5 w-5" />
    </Button>
  );
};
