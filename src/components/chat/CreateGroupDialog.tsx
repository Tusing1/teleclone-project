import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ open, onClose }: CreateGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            New Group
          </DialogTitle>
          <DialogDescription>
            Create a group chat with multiple members.
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Group chats will be available in a future update. Stay tuned!
          </p>
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}