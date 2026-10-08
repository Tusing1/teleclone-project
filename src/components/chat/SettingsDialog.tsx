import { useCallPreferences, updateCallPreference } from '@/hooks/useCallPreferences';
import { useState, useEffect } from 'react';
import { Download, Moon, Sun, Shield, Smartphone, Wifi, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const callPreferences = useCallPreferences();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [relayCheck, setRelayCheck] = useState<'idle' | 'checking' | 'ready' | 'unavailable'>('idle');

  const checkCallConnection = async () => {
    setRelayCheck('checking');
    try {
      const { data, error } = await supabase.functions.invoke('get-turn-credentials', {
        signal: AbortSignal.timeout(15000),
      });
      // Never display/log relay passwords or the response. This checks access, not audio delivery.
      const available = !error && Array.isArray(data?.iceServers) && data.iceServers.some((server: RTCIceServer | null) =>
        server && server.username && server.credential && [server.urls].flat().some(url =>
          typeof url === 'string' && /^turns?:/.test(url)));
      setRelayCheck(available ? 'ready' : 'unavailable');
    } catch {
      setRelayCheck('unavailable');
    }
  };

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Navigate to install page for instructions
      navigate('/install');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Appearance */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Calls & recordings</h3>
            {([{ key: 'noiseSuppression', label: 'Reduce background noise', hint: 'Keep busy rooms out of your microphone.' }, { key: 'echoCancellation', label: 'Echo cancellation', hint: 'Reduce speaker feedback during group calls.' }, { key: 'autoGainControl', label: 'Automatic microphone level', hint: 'Let your device balance your voice volume.' }] as const).map(setting => (
              <div key={setting.key} className="flex items-center justify-between gap-4">
                <div><Label htmlFor={setting.key}>{setting.label}</Label><p className="text-xs text-muted-foreground mt-1">{setting.hint}</p></div>
                <Switch id={setting.key} checked={callPreferences[setting.key]} onCheckedChange={value => updateCallPreference(setting.key, value)} />
              </div>
            ))}
            <p className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground leading-relaxed">These preferences apply to new calls where supported by your browser. Recording is always started manually by the host, with a visible indicator. Stopped recordings are saved to Saved messages.</p>
            <div className="space-y-2 rounded-2xl border border-border/60 p-3">
              <Button variant="outline" className="w-full gap-2" disabled={relayCheck === 'checking'} onClick={checkCallConnection}>
                {relayCheck === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                {relayCheck === 'checking' ? 'Checking relay access…' : 'Check call connection'}
              </Button>
              <p role="status" className="text-xs text-muted-foreground leading-relaxed">
                {relayCheck === 'ready' ? 'Relay credentials available for your signed-in account. Two-device audio still needs testing.' :
                  relayCheck === 'unavailable' ? 'Relay access is unavailable. Check your connection and sign-in, then try again.' :
                    'Checks signed-in relay access only. No microphone, calls or notifications.'}
              </p>
            </div>
          </section>
          <Separator />
          {/* Install App */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">App</h3>
            
            <button
              onClick={handleInstallApp}
              disabled={isInstalled}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{isInstalled ? 'App Installed' : 'Install App'}</p>
                <p className="text-xs text-muted-foreground">
                  {isInstalled ? 'The app is already installed on your device' : 'Add to your home screen for quick access'}
                </p>
              </div>
              {!isInstalled && <Download className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>

          <Separator />

          {/* About */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">About</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => {
                  navigate('/privacy');
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-left">Privacy Policy</span>
              </button>
            </div>
          </div>

          {/* Close Button */}
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
