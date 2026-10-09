import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar } from './Avatar';
import { useUsers } from '@/hooks/useUsers';
import { Profile } from '@/types/chat';

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function NewChatDialog({ open, onClose, onSelectUser }: NewChatDialogProps) {
  const { users, loading, searchUsers } = useUsers();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      setSearching(true);
      const results = await searchUsers(query);
      setSearchResults(results);
      setSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const displayUsers = search.trim() ? searchResults : users;

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
    setSearch('');
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading || searching ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {search.trim() ? 'No users found' : 'No users available'}
            </div>
          ) : (
            displayUsers.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelect(user.user_id)}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <Avatar
                  src={user.avatar_url}
                  name={user.full_name || user.username}
                  userId={user.user_id}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    @{user.username}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
