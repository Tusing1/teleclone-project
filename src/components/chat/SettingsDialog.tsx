import { useCallPreferences, updateCallPreference } from '@/hooks/useCallPreferences';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFileCache, FILES_CHANGED } from '@/hooks/useFileCache';
import { storageBudget, setStorageBudget, GIB, STORAGE_CHANGED } from '@/lib/storageBudget';
import { useAppInstall } from '@/hooks/useAppInstall';
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
  onEditProfile?: () => void;
  onOpenDownloads?: () => void;
}

export function SettingsDialog({ open, onClose, onEditProfile, onOpenDownloads }: SettingsDialogProps) {
  const { user, profile } = useAuth();
  const { getCacheStats } = useFileCache();
  const [budget, setBudget] = useState(1);
  const [usedMB, setUsedMB] = useState(0);
  const [quotaMB, setQuotaMB] = useState<number | null>(null);
  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    const refresh = () => {
      setBudget(storageBudget(user.id) / GIB);
      void getCacheStats().then(stats => { if (active) setUsedMB(stats.totalSizeMB); });
      void navigator.storage?.estimate?.().then(stats => { if (active && stats.quota) setQuotaMB(stats.quota / 1024 ** 2); });
    };
    refresh(); window.addEventListener(FILES_CHANGED, refresh); window.addEventListener(STORAGE_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(FILES_CHANGED, refresh); window.removeEventListener(STORAGE_CHANGED, refresh); };
  }, [open, user?.id, getCacheStats]);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const callPreferences = useCallPreferences();
  const { installed: isInstalled } = useAppInstall();
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

  const handleInstallApp = () => {
    navigate('/install');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <button type="button" onClick={onEditProfile} className="w-full rounded-2xl bg-secondary p-4 text-left hover:bg-secondary/70">
            <span className="block font-semibold">{profile?.full_name || profile?.username || 'Your profile'}</span>
            <span className="text-xs text-muted-foreground">Edit profile, study details and interests →</span>
          </button>
          <section className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="font-semibold">Offline storage</h3>
            <Label htmlFor="storage-budget">Storage limit on this device</Label>
            <select id="storage-budget" className="w-full rounded-xl border border-border bg-background p-3" value={budget} onChange={event => { if (user) setStorageBudget(user.id, Number(event.target.value) as 1 | 5); }}>
              <option value={1}>1 GB</option><option value={5}>5 GB</option>
            </select>
            <p className="text-xs text-muted-foreground">{usedMB.toFixed(1)} MB used. Saved downloads have no app expiry. Automatic cache lasts up to six months; only automatic copies are replaced when space is needed.</p>
            <p className="text-xs text-muted-foreground">This is a limit, not reserved storage. Your browser or phone may clear files; clearing site data removes downloads. Lowering the limit never deletes saved files.</p>
            {quotaMB !== null && quotaMB < budget * 1024 && <p className="text-xs text-amber-600">Your browser currently allows less than this limit ({Math.round(quotaMB)} MB total site quota).</p>}
            <Button variant="outline" className="w-full" onClick={onOpenDownloads}>View downloaded files</Button>
          </section>
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
