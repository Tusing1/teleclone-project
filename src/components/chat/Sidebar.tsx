import {
  LogOut, Settings, User, Moon, Sun,
  Users, UserPlus, Radio, Contact, Heart, Phone, Coins, Search, Shield, Bot, Download
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar } from './Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStudyTokens } from '@/hooks/useStudyTokens';
import { useAdmin } from '@/hooks/useAdmin';
import { useFriendRequests } from '@/hooks/useFriendRequests';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenContacts: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateChannel: () => void;
  onOpenInviteFriends: () => void;
  onOpenFindFriends: () => void;
  onOpenEditProfile: () => void;
  onOpenCallsInbox: () => void;
  onOpenStudyTokens?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenAskAI?: () => void;
  onOpenFriendRequests?: () => void;
  onOpenStudyBuddies?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({
  open,
  onClose,
  onOpenContacts,
  onOpenCreateGroup,
  onOpenCreateChannel,
  onOpenInviteFriends,
  onOpenFindFriends,
  onOpenEditProfile,
  onOpenCallsInbox,
  onOpenStudyTokens,
  onOpenGlobalSearch,
  onOpenAdminPanel,
  onOpenAskAI,
  onOpenFriendRequests,
  onOpenStudyBuddies,
  onOpenSettings
}: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { balance, streak } = useStudyTokens();
  const { isAdmin } = useAdmin();
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
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          {/* Header with user info */}
          <div className="p-6 bg-primary text-primary-foreground">
            <div className="flex items-center gap-3 mb-3">
              <Avatar
                src={profile?.avatar_url}
                name={displayName}
                size="lg"
              />
              <div className="flex-1">
                <h2 className="font-semibold text-lg">{displayName}</h2>
                <p className="text-sm text-primary-foreground/80">
                  @{profile?.username}
                </p>
                {/* Streak indicator */}
                {streak && streak.current_streak > 0 && (
                  <div className="flex items-center gap-1 text-xs text-primary-foreground/70 mt-0.5">
                    <span>🔥</span>
                    <span>{streak.current_streak} day streak</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Icons Row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {/* Tokens */}
              {onOpenStudyTokens && (
                <button
                  onClick={() => handleMenuClick(onOpenStudyTokens)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 hover:from-yellow-500/30 hover:to-orange-500/20 transition-all border border-yellow-400/20"
                >
                  <div className="p-2 rounded-full bg-yellow-400/20">
                    <Coins className="h-6 w-6 text-yellow-300" />
                  </div>
                  <span className="text-xs font-medium text-primary-foreground/90">Tokens</span>
                  <span className="text-sm font-bold text-yellow-300">{balance}</span>
                </button>
              )}

              {/* Ask AI */}
              {onOpenAskAI && (
                <button
                  onClick={() => handleMenuClick(onOpenAskAI)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 hover:from-cyan-500/30 hover:to-blue-500/20 transition-all border border-cyan-400/20"
                >
                  <div className="p-2 rounded-full bg-cyan-400/20">
                    <Bot className="h-6 w-6 text-cyan-300" />
                  </div>
                  <span className="text-xs font-medium text-primary-foreground/90">Ask AI</span>
                </button>
              )}

              {/* Search */}
              {onOpenGlobalSearch && (
                <button
                  onClick={() => handleMenuClick(onOpenGlobalSearch)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 hover:from-purple-500/30 hover:to-pink-500/20 transition-all border border-purple-400/20"
                >
                  <div className="p-2 rounded-full bg-purple-400/20">
                    <Search className="h-6 w-6 text-purple-300" />
                  </div>
                  <span className="text-xs font-medium text-primary-foreground/90">Search</span>
                </button>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 py-2 overflow-y-auto">

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
              onClick={() => handleMenuClick(onOpenStudyBuddies!)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>StudyBuddies</span>
            </button>

            {/* Friend Requests */}
            {onOpenFriendRequests && (
              <button
                onClick={() => handleMenuClick(onOpenFriendRequests)}
                className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
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

            <button
              onClick={() => handleMenuClick(onOpenCallsInbox)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span>Calls</span>
            </button>

            <Separator className="my-2" />

            <button
              onClick={() => handleMenuClick(onOpenEditProfile)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <User className="h-5 w-5 text-muted-foreground" />
              <span>My Profile</span>
            </button>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
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
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span>Settings</span>
            </button>

            {/* Admin Panel - only visible to admins */}
            {isAdmin && onOpenAdminPanel && (
              <>
                <Separator className="my-2" />
                <button
                  onClick={() => handleMenuClick(onOpenAdminPanel)}
                  className="w-full flex items-center gap-4 px-6 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <Shield className="h-5 w-5 text-orange-500" />
                  <span className="text-orange-500 font-medium">Admin Panel</span>
                </button>
              </>
            )}
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
