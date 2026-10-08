import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Download, Mic, Share2, Smartphone, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';
import { useAppInstall } from '@/hooks/useAppInstall';
import { useCallSounds } from '@/hooks/useCallSounds';
import { callErrorMessage } from '@/lib/callErrors';
import { checkMicrophoneAccess } from '@/lib/microphoneCheck';

export default function Install() {
  const navigate = useNavigate();
  const { installed, available, isIOS, install } = useAppInstall();
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState('');
  const [mic, setMic] = useState<string>('Not checked');
  const [checking, setChecking] = useState(false);
  const [micError, setMicError] = useState('');
  const { playControlTone } = useCallSounds();
  useEffect(() => {
    let disposed = false;
    let permission: PermissionStatus | undefined;
    const sync = () => { if (!disposed && permission) setMic(permission.state === 'granted' ? 'Browser allowed · test device' : permission.state === 'denied' ? 'Blocked in browser settings' : 'Permission needed'); };
    navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(status => {
      if (disposed) return;
      permission = status; sync(); permission.addEventListener('change', sync);
    }).catch(() => {});
    return () => { disposed = true; permission?.removeEventListener('change', sync); };
  }, []);
  async function checkMicrophone() {
    setChecking(true); setMicError('');
    try {
      await checkMicrophoneAccess(navigator.mediaDevices);
      setMic('Ready for calls');
    } catch (error) { setMic('Needs attention'); setMicError(callErrorMessage(error)); }
    finally { setChecking(false); }
  }
  async function requestInstall() {
    setInstalling(true); setNotice('');
    try {
      const result = await install();
      setNotice(result === 'accepted' ? 'Finish the browser installation, then open StudyGram from your home screen.' : result === 'dismissed' ? 'Installation cancelled. You can try again from the browser menu.' : 'Use the browser steps below.');
    } catch { setNotice('Installation could not open. Use your browser menu instead.'); }
    finally { setInstalling(false); }
  }
  return <div className="h-[100dvh] overflow-y-auto bg-background safe-top safe-bottom">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl">
      <Button variant="ghost" size="icon" aria-label="Back to StudyGram" onClick={() => navigate('/')}><ArrowLeft size={20} /></Button>
      <span className="text-sm font-semibold">Your pocket study space</span>
    </header>
    <main className="mx-auto max-w-lg space-y-5 px-5 pb-10 pt-8">
      <section className="text-center">
        <BrandMark className="mx-auto mb-5 h-24 w-24 shadow-xl shadow-violet-500/15" />
        <p className="text-[10px] font-semibold tracking-[.22em] text-primary">STUDY TOGETHER. ANYWHERE.</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">StudyGram, on your phone.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Your chats, channels and live audio, one tap from your home screen.</p>
      </section>
      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-4 flex items-center gap-3"><Smartphone className="text-primary" size={22} /><div><h2 className="font-semibold">{installed ? 'StudyGram is installed' : 'Make it your app'}</h2><p className="mt-1 text-xs text-muted-foreground">Android · iPhone · iPad · desktop</p></div></div>
        {installed ? <Button className="w-full rounded-2xl" onClick={() => navigate('/')}><Check size={17} className="mr-2" />Open StudyGram</Button> : available ? <Button className="w-full rounded-2xl" disabled={installing} onClick={requestInstall}><Download size={17} className="mr-2" />{installing ? 'Opening installer…' : 'Install StudyGram'}</Button> : null}
        {!installed && <ol className="mt-4 space-y-3 text-sm">
          {(isIOS ? ['Open this site in Safari on your iPhone or iPad.', 'Tap Share, then Add to Home Screen.', 'Enable Open as Web App if offered, then tap Add.'] : ['Open this site in Chrome or another supported browser.', 'Open the browser menu and choose Install app or Add to Home Screen.', 'Confirm, then launch StudyGram using its new icon.']).map((step, i) => <li className="flex items-start gap-3" key={step}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span><span className="pt-0.5">{step}</span></li>)}
        </ol>}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">This installs a web app—not an APK or IPA. Calls and new messages need internet; files you save offline use your private app cache.</p>
        {notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
      </section>
      <section className="rounded-3xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold">Prefer an iPhone shortcut file?</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Optional: download a ready-made home-screen shortcut with StudyGram’s name and icon. Normal Safari installation above does not need a profile.</p>
        <a href="/downloads/StudyGram.mobileconfig" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-sm font-semibold text-foreground"><Download size={17} />Download iPhone shortcut</a>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground"><li>Open this download in Safari on your iPhone or iPad and allow the profile download.</li><li>Open Settings → Profile Downloaded (or General → VPN &amp; Device Management).</li><li>Review the StudyGram Web Clip, then choose Install. The icon opens the live site.</li></ol>
        <p className="mt-4 rounded-xl bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">Unsigned configuration profile · shortcut only. No device management, certificates, VPN or extra permissions. You can remove it in Settings. Not an IPA or native app; microphone permission is still requested separately. Not yet tested on a physical iPhone.</p>
      </section>
      <section className="rounded-3xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold">Ready before you join</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Check your microphone without calling anyone. It switches off immediately after the check.</p>
        <div className="mt-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Mic className="text-primary" size={20} /><div><p className="text-sm font-medium">Microphone</p><p role="status" className="mt-1 text-xs text-muted-foreground">{checking ? 'Waiting for permission…' : mic}</p></div></div><Button variant="secondary" className="shrink-0 rounded-xl" disabled={checking} onClick={checkMicrophone}>{checking ? 'Checking…' : 'Check'}</Button></div>
        {micError && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">{micError}</p>}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-5"><div className="flex items-center gap-3"><Volume2 className="text-primary" size={20} /><p className="text-sm font-medium">Call sounds</p></div><Button variant="secondary" className="rounded-xl" onClick={playControlTone}>Play tone</Button></div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Allow microphone access for this site in your browser and device settings. Installation cannot override a system block or guarantee permanent permission. Use your phone’s audio controls to choose speaker, headphones or Bluetooth.</p>
      </section>
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Share2 size={14} />Install from the same website you use</span><a href="/StudyGram-install-guide.txt" download className="flex shrink-0 items-center gap-1 text-primary">Save guide <ArrowUpRight size={14} /></a></div>
    </main>
  </div>;
}
