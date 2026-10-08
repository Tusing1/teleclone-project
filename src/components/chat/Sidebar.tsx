import {
  LogOut, Settings, Moon, Sun,
  Users, UserPlus, Radio, Contact, Heart, Phone, Sparkles, Mic, HardDrive
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useFriendRequests } from '@/hooks/useFriendRequests';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenContacts: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateChannel: () => void;
  onOpenInviteFriends: () => void;
  onOpenCallsInbox: () => void;
  onOpenFriendRequests?: () => void;
  onOpenSettings?: () => void;
  onOpenRecordings?: () => void;
  onOpenDownloaded?: () => void;
}

export function Sidebar({
  open,
  onClose,
  onOpenContacts,
  onOpenCreateGroup,
  onOpenCreateChannel,
  onOpenInviteFriends,
  onOpenCallsInbox,
  onOpenFriendRequests,
  onOpenSettings,
  onOpenRecordings,
  onOpenDownloaded
}: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pendingCount } = useFriendRequests();
  const darkMode = theme === 'dark';

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
      <SheetContent side="left" className="w-80 max-w-[88vw] border-r border-border bg-background p-0">
        <div className="flex flex-col h-full">
          {/* Header with user info */}
          <div className="m-3 mt-6 rounded-[1.5rem] border border-primary/20 bg-primary/10 p-5 text-foreground">
            <div className="flex items-center gap-3">
              <Avatar
                src={profile?.avatar_url}
                name={displayName}
                size="lg"
              />
              <div className="flex-1">
                <h2 className="font-semibold text-lg">{displayName}</h2>
                <p className="text-sm text-muted-foreground">
                  @{profile?.username}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Your study space</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Learn together. Stay connected.</span>
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 py-2 overflow-y-auto scrollbar-thin">



            <p className="px-6 pt-3 pb-1 text-xs font-semibold text-muted-foreground">Connect & create</p>

            <button
              onClick={() => handleMenuClick(onOpenContacts)}
              className="sg-sidebar-row"
            >
              <Contact className="h-5 w-5 text-muted-foreground" />
              <span>Contacts</span>
            </button>

            <button
              onClick={() => handleMenuClick(onOpenCreateGroup)}
              className="sg-sidebar-row"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>New group</span>
            </button>

            <button
              onClick={() => handleMenuClick(onOpenCreateChannel)}
              className="sg-sidebar-row"
            >
              <Radio className="h-5 w-5 text-muted-foreground" />
              <span>New channel</span>
            </button>

            <button
              onClick={() => handleMenuClick(onOpenInviteFriends)}
              className="sg-sidebar-row"
            >
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <span>Invite friends</span>
            </button>

            {/* Friend requests */}
            {onOpenFriendRequests && (
              <button
                onClick={() => handleMenuClick(onOpenFriendRequests)}
                className="sg-sidebar-row"
              >
                <Heart className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-left">Friend Requests</span>
                {pendingCount > 0 && (
                  <Badge variant="default" className="bg-primary text-primary-foreground text-xs h-5 min-w-5 flex items-center justify-center">
                    {pendingCount}
                  </Badge>
                )}
              </button>
            )}

            <p className="px-6 pb-2 pt-5 text-xs font-semibold text-muted-foreground">Sessions & resources</p>
            <button
              onClick={() => handleMenuClick(onOpenCallsInbox)}
              className="sg-sidebar-row"
            >
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span>Voice sessions</span>
            </button>

            {onOpenRecordings && (
              <button
                onClick={() => handleMenuClick(onOpenRecordings)}
                className="sg-sidebar-row"
              >
                <Mic className="h-5 w-5 text-muted-foreground" />
                <span>Session recordings</span>
              </button>
            )}

            {onOpenDownloaded && <button onClick={() => handleMenuClick(onOpenDownloaded)} className="sg-sidebar-row"><HardDrive className="h-5 w-5 text-muted-foreground" /><span>Downloaded</span></button>}
            <Separator className="my-2" />
            <p className="px-6 pt-1 pb-1 text-xs font-semibold text-muted-foreground">Your account</p>

            <button
              onClick={toggleTheme}
              className="sg-sidebar-row"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>


            <button
              onClick={() => onOpenSettings && handleMenuClick(onOpenSettings)}
              className="sg-sidebar-row"
            >
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
