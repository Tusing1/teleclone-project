import { useState, useEffect } from 'react';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Profile } from '@/types/chat';

interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  conversationType: string;
  existingParticipantIds: string[];
  onMembersAdded: () => void;
}

export function AddMembersDialog({
  open,
  onClose,
  conversationId,
  conversationType,
  existingParticipantIds,
  onMembersAdded,
}: AddMembersDialogProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContacts();
      setSelectedIds([]);
      setSearchQuery('');
    }
  }, [open]);

  const fetchContacts = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Get users we have conversations with (contacts)
    const { data: conversations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!conversations || conversations.length === 0) {
      setLoading(false);
      setContacts([]);
      return;
    }

    const conversationIds = conversations.map(c => c.conversation_id);

    // Get other participants from these conversations
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id);

    if (!participants || participants.length === 0) {
      setLoading(false);
      setContacts([]);
      return;
    }

    const contactUserIds = [...new Set(participants.map(p => p.user_id))];

    // Fetch profiles excluding already existing participants
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', contactUserIds)
      .not('user_id', 'in', `(${existingParticipantIds.join(',')})`)
      .order('full_name');

    setContacts((profiles || []) as Profile[]);
    setLoading(false);
  };

  const filteredContacts = contacts.filter(contact => {
    const name = contact.full_name || contact.username || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleContact = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedIds.length === 0) return;
    
    setAdding(true);

    try {
      // Add participants
      const participantInserts = selectedIds.map(userId => ({
        conversation_id: conversationId,
        user_id: userId,
        role: 'member',
      }));

      const { error } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);

      if (error) throw error;

      // Update subscriber count for channels
      if (conversationType === 'channel') {
        const { data: conv } = await supabase
          .from('conversations')
          .select('subscriber_count')
          .eq('id', conversationId)
          .single();

        if (conv) {
          await supabase
            .from('conversations')
            .update({ subscriber_count: (conv.subscriber_count || 0) + selectedIds.length })
            .eq('id', conversationId);
        }
      }

      toast.success(`Added ${selectedIds.length} member${selectedIds.length > 1 ? 's' : ''}`);
      onMembersAdded();
      onClose();
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Members
          </DialogTitle>
          <DialogDescription>
            Add contacts to this {conversationType === 'channel' ? 'channel' : 'group'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Contacts list */}
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {contacts.length === 0 ? 'No contacts to add' : 'No matching contacts'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.user_id);
                  return (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact.user_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'
                      }`}
                    >
                      <Avatar
                        src={contact.avatar_url}
                        name={contact.full_name || contact.username || 'User'}
                        size="sm"
                        isOnline={contact.is_online}
                      />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">
                          {contact.full_name || contact.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{contact.username}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={selectedIds.length === 0 || adding}
              className="flex-1"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
