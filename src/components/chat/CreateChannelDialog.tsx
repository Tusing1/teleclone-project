import { useState } from 'react';
import { Radio } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateChannel: (name: string, description: string) => Promise<string | null>;
}

export function CreateChannelDialog({ open, onClose, onCreateChannel }: CreateChannelDialogProps) {
  const [channelName, setChannelName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!channelName.trim()) return;
    
    setCreating(true);
    const result = await onCreateChannel(channelName.trim(), description.trim());
    setCreating(false);
    
    if (result) {
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setChannelName('');
    setDescription('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name *</Label>
            <Input
              id="channel-name"
              placeholder="Enter channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Textarea
              id="channel-description"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
            />
          </div>
          
          <p className="text-sm text-muted-foreground">
            Only you (the owner) and admins can post to channels. Others can subscribe to receive updates.
          </p>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              className="flex-1"
              disabled={!channelName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
