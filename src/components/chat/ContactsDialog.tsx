import { useState } from 'react';
import { Search, MessageCircle, Contact, Phone } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface ContactsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function ContactsDialog({ open, onClose, onSelectUser }: ContactsDialogProps) {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneResults, setPhoneResults] = useState<Profile[]>([]);
  const [searchingPhone, setSearchingPhone] = useState(false);

  const filteredUsers = users.filter(u => {
    const name = u.full_name || u.username;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
  };

  const handlePhoneSearch = async () => {
    if (!phoneSearch.trim()) return;
    
    setSearchingPhone(true);
    try {
      // Normalize phone number - remove spaces, dashes, etc.
      const normalizedPhone = phoneSearch.replace(/[\s\-\(\)]/g, '');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id)
        .or(`phone_number.ilike.%${normalizedPhone}%,phone_number.ilike.%${phoneSearch}%`)
        .limit(10);

      if (error) throw error;
      
      setPhoneResults((data || []) as Profile[]);
      
      if (!data || data.length === 0) {
        toast.info('No users found with that phone number');
      }
    } catch (error) {
      console.error('Error searching by phone:', error);
      toast.error('Failed to search');
    } finally {
      setSearchingPhone(false);
    }
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

        {/* Name search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Phone number search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
              className="pl-9"
            />
          </div>
          <Button 
            onClick={handlePhoneSearch} 
            disabled={searchingPhone || !phoneSearch.trim()}
            size="sm"
          >
            {searchingPhone ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Phone search results */}
        {phoneResults.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Phone search results:</p>
            <div className="space-y-1 border rounded-lg p-2 bg-secondary/30">
              {phoneResults.map((u) => {
                const displayName = u.full_name || u.username;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar
                      src={u.avatar_url}
                      name={displayName}
                      isOnline={u.is_online}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block text-sm">{displayName}</span>
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSelect(u.user_id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto">
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
              {filteredUsers.map((u) => {
                const displayName = u.full_name || u.username;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar
                      src={u.avatar_url}
                      name={displayName}
                      isOnline={u.is_online}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{displayName}</span>
                      <span className="text-sm text-muted-foreground">@{u.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSelect(u.user_id)}
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
