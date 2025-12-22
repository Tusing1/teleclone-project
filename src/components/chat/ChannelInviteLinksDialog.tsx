import { useState, useEffect } from 'react';
import { Link2, Plus, Copy, Trash2, Users, Clock, UserX } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar } from './Avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Profile } from '@/types/chat';

interface InviteLink {
  id: string;
  code: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface InviteLinkUse {
  id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

interface ChannelInviteLinksDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  onRemoveUser?: (userId: string) => void;
}

export function ChannelInviteLinksDialog({
  open,
  onClose,
  conversationId,
  onRemoveUser,
}: ChannelInviteLinksDialogProps) {
  const { user } = useAuth();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<InviteLink | null>(null);
  const [linkUses, setLinkUses] = useState<InviteLinkUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [maxUses, setMaxUses] = useState<string>('');
  const [expiresInHours, setExpiresInHours] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, conversationId]);

  const fetchLinks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('channel_invite_links')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLinks(data as InviteLink[]);
    }
    setLoading(false);
  };

  const fetchLinkUses = async (linkId: string) => {
    const { data, error } = await supabase
      .from('invite_link_uses')
      .select('*')
      .eq('invite_link_id', linkId)
      .order('joined_at', { ascending: false });

    if (!error && data) {
      // Fetch profiles for users
      const userIds = data.map(u => u.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds);

        const usesWithProfiles = data.map(use => ({
          ...use,
          profile: profiles?.find(p => p.user_id === use.user_id)
        }));
        setLinkUses(usesWithProfiles as InviteLinkUse[]);
      } else {
        setLinkUses([]);
      }
    }
  };

  const handleCreateLink = async () => {
    if (!user) return;
    
    setCreating(true);
    const expiresAt = expiresInHours 
      ? new Date(Date.now() + parseInt(expiresInHours) * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('channel_invite_links')
      .insert({
        conversation_id: conversationId,
        created_by: user.id,
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      toast.error('Failed to create invite link');
    } else {
      toast.success('Invite link created');
      setMaxUses('');
      setExpiresInHours('');
      fetchLinks();
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const handleDeleteLink = async (linkId: string) => {
    const { error } = await supabase
      .from('channel_invite_links')
      .delete()
      .eq('id', linkId);

    if (error) {
      toast.error('Failed to delete link');
    } else {
      toast.success('Link deleted');
      if (selectedLink?.id === linkId) {
        setSelectedLink(null);
        setLinkUses([]);
      }
      fetchLinks();
    }
  };

  const handleToggleLink = async (link: InviteLink) => {
    const { error } = await supabase
      .from('channel_invite_links')
      .update({ is_active: !link.is_active })
      .eq('id', link.id);

    if (!error) {
      fetchLinks();
    }
  };

  const handleViewUses = (link: InviteLink) => {
    setSelectedLink(link);
    fetchLinkUses(link.id);
  };

  const handleRemoveUserFromLink = async (userId: string) => {
    onRemoveUser?.(userId);
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    if (date < new Date()) return 'Expired';
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-800 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Link2 className="h-5 w-5" />
            Invite Links
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create and manage invite links for your channel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Create new link */}
          <div className="space-y-3 p-3 rounded-lg bg-slate-700/50">
            <Label className="text-slate-200">Create New Link</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Max uses (empty = unlimited)"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Expires in hours (empty = never)"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>
            <Button 
              onClick={handleCreateLink} 
              disabled={creating}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Link
            </Button>
          </div>

          <Separator className="bg-slate-600" />

          {/* Links list */}
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="text-center py-4 text-slate-400">Loading...</div>
            ) : links.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No invite links yet
              </div>
            ) : selectedLink ? (
              <div className="space-y-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSelectedLink(null);
                    setLinkUses([]);
                  }}
                  className="text-slate-300 hover:text-slate-100"
                >
                  ← Back to links
                </Button>
                <div className="p-3 rounded-lg bg-slate-700/50">
                  <p className="text-sm font-medium text-slate-200">
                    Users who joined via this link ({linkUses.length})
                  </p>
                </div>
                {linkUses.length === 0 ? (
                  <div className="text-center py-4 text-slate-400">
                    No one has used this link yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkUses.map((use) => (
                      <div 
                        key={use.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={use.profile?.avatar_url}
                            name={use.profile?.full_name || use.profile?.username || 'User'}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {use.profile?.full_name || use.profile?.username}
                            </p>
                            <p className="text-xs text-slate-400">
                              Joined {new Date(use.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUserFromLink(use.user_id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <div 
                    key={link.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-mono ${link.is_active ? 'text-slate-200' : 'text-slate-500'}`}>
                          ...{link.code.slice(-8)}
                        </p>
                        {!link.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-600 text-slate-400">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {link.uses_count}{link.max_uses ? `/${link.max_uses}` : ''} uses
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatExpiry(link.expires_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewUses(link)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-200"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLink(link.code)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-200"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLink(link.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}