import { useState } from 'react';
import { Search, AtSign, MessageCircle, UserPlus, Loader2, Clock, Check } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from './Avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function GlobalSearchDialog({ open, onClose, onSelectUser }: GlobalSearchDialogProps) {
  const { user } = useAuth();
  const { sendRequest, getRequestStatus, refetch } = useFriendRequests();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [existingFriends, setExistingFriends] = useState<Set<string>>(new Set());

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
      
      // Check which users we already have conversations with
      if (data && data.length > 0) {
        const friendSet = new Set<string>();
        
        // Get all conversations the current user is in
        const { data: myConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user?.id);

        if (myConvs) {
          for (const conv of myConvs) {
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conv.conversation_id);
            
            if (participants && participants.length === 2) {
              const other = participants.find(p => p.user_id !== user?.id);
              if (other) friendSet.add(other.user_id);
            }
          }
        }
        
        setExistingFriends(friendSet);
      }
      
      if (!data || data.length === 0) {
        toast.info('No users found');
      }
      
      // Refresh friend requests to get latest status
      await refetch();
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    const success = await sendRequest(userId, requestMessage || undefined);
    if (success) {
      setSendingTo(null);
      setRequestMessage('');
    }
  };

  const handleMessage = (userId: string) => {
    onSelectUser(userId);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setSearch('');
    setResults([]);
    setHasSearched(false);
    setSendingTo(null);
    setRequestMessage('');
  };

  const getButtonForUser = (u: Profile) => {
    const isFriend = existingFriends.has(u.user_id);
    const requestStatus = getRequestStatus(u.user_id);
    
    if (isFriend || requestStatus === 'friends') {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleMessage(u.user_id)}
          className="gap-1"
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </Button>
      );
    }
    
    if (requestStatus === 'pending_sent') {
      return (
        <Button variant="ghost" size="sm" disabled className="gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          Pending
        </Button>
      );
    }
    
    if (requestStatus === 'pending_received') {
      return (
        <Button variant="ghost" size="sm" disabled className="gap-1 text-green-600">
          <Check className="h-4 w-4" />
          Accept in Requests
        </Button>
      );
    }
    
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSendingTo(u.user_id)}
        className="gap-1"
      >
        <UserPlus className="h-4 w-4" />
        Add
      </Button>
    );
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

        {/* Send Request Dialog */}
        {sendingTo && (
          <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
            <p className="font-medium text-sm">Send friend request</p>
            <Textarea
              placeholder="Add a message (optional)"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={2}
              maxLength={200}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleSendRequest(sendingTo)}
                className="flex-1"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Send Request
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSendingTo(null); setRequestMessage(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

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
                    {getButtonForUser(u)}
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
