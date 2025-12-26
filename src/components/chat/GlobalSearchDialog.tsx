import { useState } from 'react';
import { Search, AtSign, MessageCircle, UserPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from './Avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function GlobalSearchDialog({ open, onClose, onSelectUser }: GlobalSearchDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      // Remove @ prefix if present
      const query = search.startsWith('@') ? search.slice(1) : search;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id)
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      
      setResults((data || []) as Profile[]);
      
      if (!data || data.length === 0) {
        toast.info('No users found');
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
    setSearch('');
    setResults([]);
    setHasSearched(false);
  };

  const handleClose = () => {
    onClose();
    setSearch('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </DialogTitle>
          <DialogDescription>
            Find anyone by their @username or name
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search @username or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={loading || !search.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-72">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
              <p className="text-xs mt-1">Try a different username</p>
            </div>
          ) : results.length === 0 && !hasSearched ? (
            <div className="text-center py-8 text-muted-foreground">
              <AtSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Search for users</p>
              <p className="text-xs mt-1">Enter a @username or name to find people</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((u) => {
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
                      title="Start chat"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
