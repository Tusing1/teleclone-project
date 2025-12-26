import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Smartphone, Share, Plus, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="h-full h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Already Installed!</h1>
        <p className="text-muted-foreground mb-6">
          StudyGram is already installed on your device.
        </p>
        <Button onClick={() => navigate('/')}>
          Open App
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full h-[100dvh] flex flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Install StudyGram</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* App preview */}
        <div className="flex flex-col items-center text-center mb-8">
          <img 
            src="/pwa-192x192.png" 
            alt="StudyGram" 
            className="w-24 h-24 rounded-2xl shadow-lg mb-4"
          />
          <h2 className="text-xl font-bold">StudyGram</h2>
          <p className="text-muted-foreground">Connect, Learn, Share</p>
        </div>

        {/* Benefits */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
            <Smartphone className="w-6 h-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium">Works like a native app</h3>
              <p className="text-sm text-muted-foreground">
                Full-screen experience without browser bars
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
            <Download className="w-6 h-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium">Instant access from home screen</h3>
              <p className="text-sm text-muted-foreground">
                Launch directly without opening browser
              </p>
            </div>
          </div>
        </div>

        {/* Install instructions */}
        {isIOS ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-center">How to install on iOS</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">1</div>
                <p className="text-sm">Tap the <Share className="inline w-4 h-4" /> Share button in Safari</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">2</div>
                <p className="text-sm">Scroll down and tap "Add to Home Screen"</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">3</div>
                <p className="text-sm">Tap "Add" to install StudyGram</p>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download className="w-5 h-5 mr-2" />
            Install StudyGram
          </Button>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold text-center">How to install</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">1</div>
                <p className="text-sm">Open menu (three dots) in your browser</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">2</div>
                <p className="text-sm">Tap "Install app" or "Add to Home Screen"</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">3</div>
                <p className="text-sm">Confirm to install StudyGram</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}