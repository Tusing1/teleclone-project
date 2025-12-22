import React, { useState } from 'react';
import { ArrowLeft, Radio, Calendar, Edit2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LiveStreamPreviewProps {
  channelName: string;
  channelAvatar?: string;
  subscriberCount: number;
  onStart: (title: string) => void;
  onSchedule: () => void;
  onClose: () => void;
}

export const LiveStreamPreview: React.FC<LiveStreamPreviewProps> = ({
  channelName,
  channelAvatar,
  subscriberCount,
  onStart,
  onSchedule,
  onClose
}) => {
  const [streamTitle, setStreamTitle] = useState('Live Stream');
  const [showTitleDialog, setShowTitleDialog] = useState(false);

  const handleStartStream = () => {
    onStart(streamTitle);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowTitleDialog(true)}>
            <Edit2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Channel Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Avatar 
          name={channelName} 
          src={channelAvatar} 
          size="lg" 
          className="w-32 h-32 mb-4"
        />
        <h2 className="text-2xl font-bold text-center mb-1">{channelName}</h2>
        <p className="text-muted-foreground text-sm mb-8">private channel</p>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          <div className="flex flex-col items-center gap-1 px-4 py-3 bg-muted rounded-xl">
            <Radio className="h-6 w-6" />
            <span className="text-xs">Live Stream</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-4 py-3 bg-muted rounded-xl">
            <span className="text-lg">🔔</span>
            <span className="text-xs">Mute</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-4 py-3 bg-muted rounded-xl">
            <span className="text-lg">💬</span>
            <span className="text-xs">Discuss</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-4 py-3 bg-muted rounded-xl">
            <span className="text-lg">➕</span>
            <span className="text-xs">Add Story</span>
          </div>
        </div>

        {/* Stream Info Card */}
        <div className="bg-muted/50 rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="text-4xl">🎙️</div>
          </div>
          <h3 className="text-xl font-bold mb-2">{streamTitle}</h3>
          <p className="text-sm text-muted-foreground">
            Subscribers of this channel will be notified once you start the live stream.
          </p>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-6 space-y-3">
        <Button 
          className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90" 
          onClick={handleStartStream}
        >
          Start Live Stream
        </Button>
        <Button 
          variant="link" 
          className="w-full text-primary"
          onClick={onSchedule}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Live Stream
        </Button>
      </div>

      {/* Edit Title Dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stream Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter stream title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTitleDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowTitleDialog(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
