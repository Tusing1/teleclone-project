import { useState } from 'react';
import { Phone, UserPlus, Share2, Search, MessageCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from './Avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/chat';
import { toast } from 'sonner';

interface ContactsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onOpenInvite: () => void;
}

export function ContactsDialog({ open, onClose, onSelectUser, onOpenInvite }: ContactsDialogProps) {
  const { user, profile } = useAuth();
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneResults, setPhoneResults] = useState<Profile[]>([]);
  const [searchingPhone, setSearchingPhone] = useState(false);

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

  const handleInviteContacts = () => {
    onClose();
    onOpenInvite();
  };

  const handleSyncContacts = () => {
    toast.info('Contact sync requires the mobile app');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contacts
          </DialogTitle>
          <DialogDescription>
            Find friends by phone number or invite them to join
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button 
            variant="outline" 
            onClick={handleSyncContacts}
            className="h-20 flex-col gap-2"
          >
            <Phone className="h-6 w-6" />
            <span className="text-xs">Sync Contacts</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleInviteContacts}
            className="h-20 flex-col gap-2"
          >
            <UserPlus className="h-6 w-6" />
            <span className="text-xs">Invite Friends</span>
          </Button>
        </div>

        {/* Phone number search */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Search by phone number</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="+1 234 567 8900"
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
              {searchingPhone ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Phone search results */}
        {phoneResults.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Results:</p>
            <div className="space-y-1 border rounded-lg p-2 bg-secondary/30 max-h-48 overflow-y-auto">
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
                      userId={u.user_id}
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

        {/* Empty state when no results */}
        {phoneResults.length === 0 && !searchingPhone && (
          <div className="text-center py-6 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Enter a phone number to find friends</p>
            <p className="text-xs mt-1">or invite them to join StudyGram</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
