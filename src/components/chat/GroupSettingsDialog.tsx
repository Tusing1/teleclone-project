import { useState, useEffect } from 'react';
import { Pencil, Settings, Users, Trash2, UserPlus, Crown, Shield } from 'lucide-react';
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
import { Avatar } from './Avatar';
import { ConversationWithDetails } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface GroupSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  group: ConversationWithDetails | null;
  isOwner: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
}

export function GroupSettingsDialog({ 
  open, 
  onClose, 
  group, 
  isOwner,
  isAdmin,
  onRefresh 
}: GroupSettingsDialogProps) {
  const { user } = useAuth();
  const [editingInfo, setEditingInfo] = useState(false);
  useEffect(() => { if (open) setEditingInfo(false); }, [open]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
    }
  }, [group]);

  const handleSave = async () => {
    if (!group || (!isOwner && !isAdmin)) return;

    setSaving(true);
    const { error } = await supabase
      .from('conversations')
      .update({ 
        name: name.trim() || null,
        description: description.trim() || null 
      })
      .eq('id', group.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to update group settings');
    } else {
      toast.success('Group settings updated');
      onRefresh();
      onClose();
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    if (!group || !isOwner) return;

    const { error } = await supabase
      .from('conversation_participants')
      .update({ role: 'admin' })
      .eq('conversation_id', group.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to promote member');
    } else {
      toast.success('Member promoted to admin');
      onRefresh();
    }
  };

  const handleDemoteToMember = async (userId: string) => {
    if (!group || !isOwner) return;

    const { error } = await supabase
      .from('conversation_participants')
      .update({ role: 'member' })
      .eq('conversation_id', group.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to demote admin');
    } else {
      toast.success('Admin demoted to member');
      onRefresh();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!group || (!isOwner && !isAdmin)) return;

    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', group.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to remove member');
    } else {
      toast.success('Member removed from group');
      onRefresh();
    }
  };

  if (!group) return null;

  const canEdit = isOwner || isAdmin;
  const members = group.participants || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[92dvh] flex flex-col rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Group Settings
          </DialogTitle>
          <DialogDescription>
            Manage your group settings and members.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-4 py-4">
            {/* Group Info */}
            <div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-secondary/30 text-center">
              <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden">
                {group.avatar_url ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-10 h-10 text-primary" />}
              </div>
              <div>
                <p className="text-2xl font-bold">{group.name}</p>
                <p className="text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {!editingInfo && group.description && <p className="rounded-2xl bg-secondary/40 p-4 text-sm whitespace-pre-wrap">{group.description}</p>}
            {canEdit && <Button variant="secondary" className="w-full rounded-2xl" onClick={() => { if (editingInfo) { setName(group.name || ''); setDescription(group.description || ''); } setEditingInfo(v => !v); }}><Pencil className="h-4 w-4 mr-2" />{editingInfo ? 'Cancel info edits' : 'Edit group info'}</Button>}
            {canEdit && editingInfo && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-desc">Description</Label>
                  <Textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                    rows={2}
                  />
                </div>

                <Separator />
              </>
            )}

            {/* Members Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members ({members.length})
              </Label>

              <div className="space-y-2">
                {members.map((participant) => {
                  const profile = participant.profile;
                  const isCurrentUser = participant.user_id === user?.id;
                  const isMemberOwner = participant.role === 'owner';
                  const isMemberAdmin = participant.role === 'admin';

                  return (
                    <div 
                      key={participant.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-secondary/40"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={profile?.avatar_url}
                          name={profile?.full_name || profile?.username || 'User'}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1">
                            {profile?.full_name || profile?.username}
                            {isMemberOwner && (
                              <Crown className="h-3 w-3 text-yellow-500" />
                            )}
                            {isMemberAdmin && !isMemberOwner && (
                              <Shield className="h-3 w-3 text-blue-500" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{profile?.username}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isCurrentUser && !isMemberOwner && (
                        <div className="flex items-center gap-1">
                          {isOwner && (
                            <>
                              {isMemberAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDemoteToMember(participant.user_id)}
                                  title="Demote to member"
                                >
                                  <Shield className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePromoteToAdmin(participant.user_id)}
                                  title="Promote to admin"
                                >
                                  <Shield className="h-4 w-4 text-blue-500" />
                                </Button>
                              )}
                            </>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(participant.user_id)}
                              className="text-destructive hover:text-destructive"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
          {canEdit && editingInfo && (
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
