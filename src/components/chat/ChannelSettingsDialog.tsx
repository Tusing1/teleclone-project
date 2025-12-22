import { useState, useEffect } from 'react';
import { Settings, Radio, MessageCircle, Users, Trash2, Link2, Calendar, ChevronRight, Shield } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationWithDetails } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChannelInviteLinksDialog } from './ChannelInviteLinksDialog';
import { ChannelSubscribersDialog } from './ChannelSubscribersDialog';
import { ScheduleCallDialog } from './ScheduleCallDialog';

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
  
  // Sub-dialogs
  const [showInviteLinks, setShowInviteLinks] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  
  // Counts
  const [inviteLinksCount, setInviteLinksCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      fetchDiscussionInfo();
      fetchCounts();
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

  const fetchCounts = async () => {
    if (!channel) return;

    // Fetch invite links count
    const { count: linksCount } = await supabase
      .from('channel_invite_links')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', channel.id);

    setInviteLinksCount(linksCount || 0);

    // Count admins
    const admins = channel.participants.filter(p => p.role === 'admin' || p.role === 'owner');
    setAdminCount(admins.length);
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

  const handleRemoveUser = async (userId: string) => {
    if (!channel) return;
    
    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', channel.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to remove user');
    } else {
      toast.success('User removed');
      onRefresh();
    }
  };

  if (!channel) return null;

  const subscriberCount = channel.participants?.length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Settings className="h-5 w-5" />
              Channel Settings
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Manage your channel settings and members.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 py-4 pr-4">
              {/* Channel Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center">
                  <Radio className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">{channel.name}</p>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {isOwner && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="channel-name" className="text-slate-300">Channel Name</Label>
                    <Input
                      id="channel-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={50}
                      className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-desc" className="text-slate-300">Description</Label>
                    <Textarea
                      id="channel-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={200}
                      rows={2}
                      className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>

                  <Separator className="bg-slate-600" />
                </>
              )}

              {/* Menu Items */}
              <div className="space-y-1">
                {/* Invite Links */}
                <button
                  onClick={() => setShowInviteLinks(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-blue-400" />
                    <span className="text-slate-200">Invite Links</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{inviteLinksCount}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                {/* Administrators */}
                <button
                  onClick={() => setShowSubscribers(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-amber-400" />
                    <span className="text-slate-200">Administrators</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{adminCount}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                {/* Subscribers */}
                <button
                  onClick={() => setShowSubscribers(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-400" />
                    <span className="text-slate-200">Subscribers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{subscriberCount}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                {/* Schedule Call */}
                <button
                  onClick={() => setShowScheduleCall(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-purple-400" />
                    <span className="text-slate-200">Schedule Call</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                {isOwner && (
                  <>
                    <Separator className="bg-slate-600 my-2" />

                    {/* Discussion Group Section */}
                    <div className="p-3">
                      <Label className="flex items-center gap-2 text-slate-300 mb-2">
                        <MessageCircle className="h-4 w-4" />
                        Discussion Group
                      </Label>

                      {discussionInfo ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-600 bg-slate-700/30">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-slate-200">{discussionInfo.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleUnlinkDiscussion}
                            disabled={saving}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
                          onClick={handleCreateDiscussion}
                          disabled={saving}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Add Discussion Group
                        </Button>
                      )}

                      <p className="text-xs text-slate-400 mt-2">
                        {discussionInfo 
                          ? 'Subscribers can discuss channel posts in the linked group.'
                          : 'Create a discussion group where subscribers can chat about channel posts.'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  className="flex-1 border-slate-600 text-slate-200 hover:bg-slate-700"
                >
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
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <ChannelInviteLinksDialog
        open={showInviteLinks}
        onClose={() => setShowInviteLinks(false)}
        conversationId={channel.id}
        onRemoveUser={handleRemoveUser}
      />

      <ChannelSubscribersDialog
        open={showSubscribers}
        onClose={() => setShowSubscribers(false)}
        conversationId={channel.id}
        participants={channel.participants}
        isOwner={isOwner}
        onRefresh={onRefresh}
      />

      <ScheduleCallDialog
        open={showScheduleCall}
        onClose={() => setShowScheduleCall(false)}
        conversationId={channel.id}
      />
    </>
  );
}