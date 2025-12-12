import React from 'react';
import { Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CallButtonProps {
  onStartCall: (type: 'voice' | 'video') => void;
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Phone className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onStartCall('voice')}>
          <Phone className="h-4 w-4 mr-2" />
          Voice Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStartCall('video')}>
          <Video className="h-4 w-4 mr-2" />
          Video Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};