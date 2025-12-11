import { Radio } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateChannelDialog({ open, onClose }: CreateChannelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            New Channel
          </DialogTitle>
          <DialogDescription>
            Create a channel to broadcast messages to subscribers.
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center">
          <Radio className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Channels will be available in a future update. Stay tuned!
          </p>
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}