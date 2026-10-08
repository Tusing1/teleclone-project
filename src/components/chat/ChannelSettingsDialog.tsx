import { useState, useEffect, useRef } from 'react';
import { Pencil, Settings, Radio, MessageCircle, Users, Trash2, Link2, Calendar, ChevronRight, Shield, Camera } from 'lucide-react';
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
  const [editingInfo, setEditingInfo] = useState(false);
  useEffect(() => { if (open) setEditingInfo(false); }, [open]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [discussionInfo, setDiscussionInfo] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      setAvatarUrl(channel.avatar_url || null);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channel) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `channel-${channel.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success('Avatar uploaded');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!channel || !isOwner) return;

    setSaving(true);
    const { error } = await supabase
      .from('conversations')
      .update({ 
        name: name.trim() || null,
        description: description.trim() || null,
        avatar_url: avatarUrl
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
        <DialogContent className="sm:max-w-md max-h-[92dvh] rounded-3xl bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Settings className="h-5 w-5" />
              Channel Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manage your channel settings and members.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 py-4 pr-4">
              {/* Channel Info with Avatar Upload */}
              <div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-secondary/30 text-center">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Channel" className="w-full h-full object-cover" />
                    ) : (
                      <Radio className="h-6 w-6 text-white" />
                    )}
                  </div>
                  {isOwner && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        aria-label="Change channel photo"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
                      >
                        <Camera className="h-5 w-5 text-white" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-bold text-foreground">{channel.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {!editingInfo && channel.description && <p className="rounded-2xl bg-secondary/40 p-4 text-sm whitespace-pre-wrap">{channel.description}</p>}
              {isOwner && <Button variant="secondary" className="w-full rounded-2xl" onClick={() => { if (editingInfo) { setName(channel.name || ''); setDescription(channel.description || ''); } setEditingInfo(v => !v); }}><Pencil className="h-4 w-4 mr-2" />{editingInfo ? 'Cancel info edits' : 'Edit channel info'}</Button>}
              {isOwner && editingInfo && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="channel-name" className="text-foreground">Channel Name</Label>
                    <Input
                      id="channel-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={50}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-desc" className="text-foreground">Description</Label>
                    <Textarea
                      id="channel-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={200}
                      rows={2}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <Separator className="bg-border" />
                </>
              )}

              {/* Menu Items */}
              <div className="space-y-1 rounded-3xl bg-secondary/30 p-2">
                {/* Invite Links */}
                <button
                  onClick={() => setShowInviteLinks(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-blue-400" />
                    <span className="text-foreground">Invite Links</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{inviteLinksCount}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Administrators */}
                <button
                  onClick={() => setShowSubscribers(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-amber-400" />
                    <span className="text-foreground">Administrators</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{adminCount}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Subscribers */}
                <button
                  onClick={() => setShowSubscribers(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-400" />
                    <span className="text-foreground">Subscribers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{subscriberCount}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Schedule Call */}
                <button
                  onClick={() => setShowScheduleCall(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-purple-400" />
                    <span className="text-foreground">Schedule Call</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                {isOwner && (
                  <>
                    <Separator className="bg-border my-2" />

                    {/* Discussion Group Section */}
                    <div className="p-3">
                      <Label className="flex items-center gap-2 text-foreground mb-2">
                        <MessageCircle className="h-4 w-4" />
                        Discussion Group
                      </Label>

                      {discussionInfo ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-foreground">{discussionInfo.name}</span>
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
                          className="w-full border-border text-foreground hover:bg-secondary"
                          onClick={handleCreateDiscussion}
                          disabled={saving}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Add Discussion Group
                        </Button>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
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
                  className="flex-1 border-border text-foreground hover:bg-secondary"
                >
                  {isOwner ? 'Cancel' : 'Close'}
                </Button>
                {isOwner && editingInfo && (
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
        conversationType="channel"
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
