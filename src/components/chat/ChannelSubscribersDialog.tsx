import { useState } from 'react';
import { Users, Shield, ShieldCheck, UserX, Ban, Search, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { AddMembersDialog } from './AddMembersDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Profile, ConversationParticipant } from '@/types/chat';

interface Subscriber {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: Profile;
}

interface ChannelSubscribersDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  conversationType?: string;
  participants: (ConversationParticipant & { profile: Profile })[];
  isOwner: boolean;
  onRefresh: () => void;
}

export function ChannelSubscribersDialog({
  open,
  onClose,
  conversationId,
  conversationType = 'channel',
  participants,
  isOwner,
  onRefresh,
}: ChannelSubscribersDialogProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const filteredParticipants = participants.filter(p => {
    const name = p.profile?.full_name || p.profile?.username || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handlePromoteToAdmin = async (userId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('conversation_participants')
      .update({ role: 'admin' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    setLoading(false);

    if (error) {
      toast.error('Failed to promote user');
    } else {
      toast.success('User promoted to admin');
      onRefresh();
    }
  };

  const handleDemoteToMember = async (userId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('conversation_participants')
      .update({ role: 'member' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    setLoading(false);

    if (error) {
      toast.error('Failed to demote user');
    } else {
      toast.success('User demoted to member');
      onRefresh();
    }
  };

  const handleRemoveUser = async (userId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    setLoading(false);

    if (error) {
      toast.error('Failed to remove user');
    } else {
      toast.success('User removed');
      onRefresh();
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!user) return;
    
    setLoading(true);
    
    // First remove from participants
    await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    // Then add to banned list
    const { error } = await supabase
      .from('channel_banned_users')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        banned_by: user.id,
      });

    setLoading(false);

    if (error) {
      toast.error('Failed to ban user');
    } else {
      toast.success('User banned');
      onRefresh();
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Owner
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subscribers ({participants.length})
              </span>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMembers(true)}
                  className="text-xs"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add Members
                </Button>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manage {conversationType === 'channel' ? 'channel' : 'group'} subscribers and their roles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subscribers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Subscribers list */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredParticipants.map((participant) => {
                  const isCurrentUser = participant.user_id === user?.id;
                  const canManage = isOwner && !isCurrentUser && participant.role !== 'owner';
                  const isAdmin = participant.role === 'admin';

                  return (
                    <div 
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={participant.profile?.avatar_url}
                          name={participant.profile?.full_name || participant.profile?.username || 'User'}
                          size="sm"
                          userId={participant.profile?.user_id}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {participant.profile?.full_name || participant.profile?.username}
                              {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                            </p>
                            {getRoleBadge(participant.role)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @{participant.profile?.username}
                          </p>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDemoteToMember(participant.user_id)}
                              disabled={loading}
                              className="text-muted-foreground hover:text-foreground text-xs"
                            >
                              Demote
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePromoteToAdmin(participant.user_id)}
                              disabled={loading}
                              className="text-primary hover:text-primary/80 text-xs"
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(participant.user_id)}
                            disabled={loading}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Remove"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleBanUser(participant.user_id)}
                            disabled={loading}
                            className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/20"
                            title="Ban"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <AddMembersDialog
        open={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        conversationId={conversationId}
        conversationType={conversationType}
        existingParticipantIds={participants.map(p => p.user_id)}
        onMembersAdded={onRefresh}
      />
    </>
  );
}
