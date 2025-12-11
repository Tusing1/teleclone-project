import { useState } from 'react';
import { Search, MessageCircle, Contact } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { useUsers } from '@/hooks/useUsers';

interface ContactsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function ContactsDialog({ open, onClose, onSelectUser }: ContactsDialogProps) {
  const { users, loading } = useUsers();
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter(user => {
    const name = user.full_name || user.username;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Contact className="h-5 w-5" />
            Contacts
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading contacts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Contact className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No contacts found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => {
                const displayName = user.full_name || user.username;
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar
                      src={user.avatar_url}
                      name={displayName}
                      isOnline={user.is_online}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{displayName}</span>
                      <span className="text-sm text-muted-foreground">@{user.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSelect(user.user_id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}