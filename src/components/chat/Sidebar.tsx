import { 
  LogOut, Settings, User, Moon, Sun, Bookmark, Archive, 
  Users, UserPlus, Radio, Contact, Heart 
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenSavedMessages: () => void;
  onOpenArchived: () => void;
  onOpenContacts: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateChannel: () => void;
  onOpenInviteFriends: () => void;
  onOpenFindFriends: () => void;
}

export function Sidebar({ 
  open, 
  onClose,
  onOpenSavedMessages,
  onOpenArchived,
  onOpenContacts,
  onOpenCreateGroup,
  onOpenCreateChannel,
  onOpenInviteFriends,
  onOpenFindFriends
}: SidebarProps) {
  const { profile, signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const handleMenuClick = (action: () => void) => {
    action();
    onClose();
  };

  const displayName = profile?.full_name || profile?.username || 'User';

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          {/* Header with user info */}
          <div className="p-6 bg-primary text-primary-foreground">
            <Avatar
              src={profile?.avatar_url}
              name={displayName}
              size="lg"
              className="mb-3"
            />
            <h2 className="font-semibold text-lg">{displayName}</h2>
            <p className="text-sm text-primary-foreground/80">
              @{profile?.username}
            </p>
          </div>

          {/* Menu items */}
          <div className="flex-1 py-2 overflow-y-auto">
            <button 
              onClick={() => handleMenuClick(onOpenSavedMessages)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Bookmark className="h-5 w-5 text-muted-foreground" />
              <span>Saved Messages</span>
            </button>

            <button 
              onClick={() => handleMenuClick(onOpenArchived)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Archive className="h-5 w-5 text-muted-foreground" />
              <span>Archived Chats</span>
            </button>

            <Separator className="my-2" />

            <button 
              onClick={() => handleMenuClick(onOpenContacts)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Contact className="h-5 w-5 text-muted-foreground" />
              <span>Contacts</span>
            </button>

            <button 
              onClick={() => handleMenuClick(onOpenCreateGroup)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>New Group</span>
            </button>

            <button 
              onClick={() => handleMenuClick(onOpenCreateChannel)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Radio className="h-5 w-5 text-muted-foreground" />
              <span>New Channel</span>
            </button>

            <button 
              onClick={() => handleMenuClick(onOpenInviteFriends)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <span>Invite Friends</span>
            </button>

            <button 
              onClick={() => handleMenuClick(onOpenFindFriends)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors group"
            >
              <div className="relative">
                <Heart className="h-5 w-5 text-pink-500" />
              </div>
              <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent font-medium">
                Find Friends
              </span>
            </button>

            <Separator className="my-2" />

            <button className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors">
              <User className="h-5 w-5 text-muted-foreground" />
              <span>My Profile</span>
            </button>

            <button 
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span>Settings</span>
            </button>
          </div>

          {/* Sign out */}
          <div className="p-4 border-t border-border">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-4 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}