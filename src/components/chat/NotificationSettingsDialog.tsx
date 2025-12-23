import { Bell, BellOff, Loader2, Smartphone, Check, X, Volume2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationSettingsDialog({ open, onClose }: NotificationSettingsDialogProps) {
  const {
    supported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (!success) {
      toast.error('Failed to send test notification');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </DialogTitle>
          <DialogDescription>
            Get notified about new messages, matches, and calls
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!supported ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Not Supported</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Push notifications are not supported in this browser.
                  Try using Chrome, Firefox, or Edge.
                </p>
              </div>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Permission Denied</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You've blocked notifications for this site.
                  Please enable them in your browser settings.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Main toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    isSubscribed 
                      ? "bg-gradient-to-r from-pink-500 to-purple-600" 
                      : "bg-muted"
                  )}>
                    {isSubscribed ? (
                      <Bell className="h-5 w-5 text-white" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-medium">
                      Push Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleToggle}
                  disabled={loading}
                />
              </div>

              {/* Info section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  You'll be notified about:
                </h4>
                <div className="space-y-2">
                  {[
                    { icon: '💬', text: 'New messages' },
                    { icon: '💕', text: 'New matches in Find Friends' },
                    { icon: '❤️', text: 'When someone likes you' },
                    { icon: '📞', text: 'Incoming calls' },
                    { icon: '📢', text: 'Channel updates' },
                  ].map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 p-2 rounded-lg"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.text}</span>
                      {isSubscribed && (
                        <Check className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Device info */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <span>
                  Notifications will be sent to this device
                </span>
              </div>

              {/* Test notification button */}
              {isSubscribed && (
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleTestNotification}
                  disabled={loading}
                >
                  <Volume2 className="h-4 w-4" />
                  Send Test Notification
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
