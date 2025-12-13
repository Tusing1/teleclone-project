import { useState, useEffect } from 'react';
import { Settings, Radio, MessageCircle, Users, Trash2, Link2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ConversationWithDetails } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChannelSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  channel: ConversationWithDetails | null;
  isOwner: boolean;
  onRefresh: () => void;
}

export function ChannelSettingsDialog({ 
  open, 
  onClose, 
  channel, 
  isOwner,
  onRefresh 
}: ChannelSettingsDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [discussionInfo, setDiscussionInfo] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      fetchDiscussionInfo();
    }
  }, [channel]);

  const fetchDiscussionInfo = async () => {
    if (!channel?.linked_discussion_id) {
      setDiscussionInfo(null);
      return;
    }

    const { data } = await supabase
      .from('conversations')
      .select('id, name')
      .eq('id', channel.linked_discussion_id)
      .single();

    if (data) {
      setDiscussionInfo({ id: data.id, name: data.name || 'Discussion' });
    }
  };

  const handleSave = async () => {
    if (!channel || !isOwner) return;

    setSaving(true);
    const { error } = await supabase
      .from('conversations')
      .update({ 
        name: name.trim() || null,
        description: description.trim() || null 
      })
      .eq('id', channel.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to update channel settings');
    } else {
      toast.success('Channel settings updated');
      onRefresh();
      onClose();
    }
  };

  const handleCreateDiscussion = async () => {
    if (!channel || !isOwner || channel.linked_discussion_id) return;

    setSaving(true);
    
    // Create discussion group via edge function
    const { data, error } = await supabase.functions.invoke('create-conversation', {
      body: { 
        type: 'group', 
        name: `${channel.name} Discussion`,
        description: `Discussion group for ${channel.name} channel`,
        memberIds: []
      }
    });

    if (error || !data?.id) {
      toast.error('Failed to create discussion group');
      setSaving(false);
      return;
    }

    // Link discussion to channel
    const { error: linkError } = await supabase
      .from('conversations')
      .update({ linked_discussion_id: data.id })
      .eq('id', channel.id);

    setSaving(false);

    if (linkError) {
      toast.error('Failed to link discussion group');
    } else {
      toast.success('Discussion group created');
      onRefresh();
    }
  };

  const handleUnlinkDiscussion = async () => {
    if (!channel || !isOwner || !channel.linked_discussion_id) return;

    setSaving(true);
    const { error } = await supabase
      .from('conversations')
      .update({ linked_discussion_id: null })
      .eq('id', channel.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to unlink discussion group');
    } else {
      toast.success('Discussion group unlinked');
      setDiscussionInfo(null);
      onRefresh();
    }
  };

  if (!channel) return null;

  const subscriberCount = channel.participants?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Channel Settings
          </DialogTitle>
          <DialogDescription>
            Manage your channel settings and linked discussion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Channel Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
            <Radio className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{channel.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {isOwner && (
            <>
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-desc">Description</Label>
                <Textarea
                  id="channel-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={2}
                />
              </div>

              <Separator />

              {/* Discussion Group Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Discussion Group
                </Label>

                {discussionInfo ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{discussionInfo.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleUnlinkDiscussion}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCreateDiscussion}
                    disabled={saving}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Add Discussion Group
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  {discussionInfo 
                    ? 'Subscribers can discuss channel posts in the linked group.'
                    : 'Create a discussion group where subscribers can chat about channel posts.'}
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {isOwner ? 'Cancel' : 'Close'}
            </Button>
            {isOwner && (
              <Button 
                onClick={handleSave} 
                className="flex-1"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}