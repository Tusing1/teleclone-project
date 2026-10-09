import { useState } from 'react';
import { Users, Search, Check, X } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { useUsers } from '@/hooks/useUsers';
import { Profile } from '@/types/chat';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<string | null>;
}

export function CreateGroupDialog({ open, onClose, onCreateGroup }: CreateGroupDialogProps) {
  const { users, loading } = useUsers();
  const [step, setStep] = useState<'details' | 'members'>('details');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredUsers = users.filter(
    user =>
      (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !selectedMembers.some(m => m.user_id === user.user_id)
  );

  const handleToggleMember = (user: Profile) => {
    if (selectedMembers.some(m => m.user_id === user.user_id)) {
      setSelectedMembers(selectedMembers.filter(m => m.user_id !== user.user_id));
    } else {
      setSelectedMembers([...selectedMembers, user]);
    }
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.user_id !== userId));
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    
    setCreating(true);
    const memberIds = selectedMembers.map(m => m.user_id);
    const result = await onCreateGroup(groupName.trim(), description.trim(), memberIds);
    setCreating(false);
    
    if (result) {
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setStep('details');
    setGroupName('');
    setDescription('');
    setSelectedMembers([]);
    setSearchQuery('');
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
            <Users className="h-5 w-5" />
            New Group
          </DialogTitle>
          <DialogDescription>
            {step === 'details' 
              ? 'Enter group details to get started.'
              : 'Add members to your group.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'details' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => setStep('members')} 
                className="flex-1"
                disabled={!groupName.trim()}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map(member => (
                  <div 
                    key={member.user_id}
                    className="flex items-center gap-1 bg-primary/10 text-primary rounded-full pl-1 pr-2 py-1"
                  >
                    <Avatar 
                      src={member.avatar_url} 
                      name={member.username} 
                      size="sm"
                    />
                    <span className="text-sm">{member.username}</span>
                    <button 
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* User list */}
            <ScrollArea className="h-[200px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map(user => (
                    <button
                      key={user.user_id}
                      onClick={() => handleToggleMember(user)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar 
                        src={user.avatar_url} 
                        name={user.username} 
                        userId={user.user_id}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{user.full_name || user.username}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                      </div>
                      {selectedMembers.some(m => m.user_id === user.user_id) && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleCreate} 
                className="flex-1"
                disabled={selectedMembers.length === 0 || creating}
              >
                {creating ? 'Creating...' : `Create Group (${selectedMembers.length})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
