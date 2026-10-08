import { useState } from 'react';
import { ArrowLeft, AudioWaveform, Calendar, Mic, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function LiveStreamPreview({ channelName, channelAvatar, subscriberCount, onStart, onSchedule, onClose }: {
  channelName: string; channelAvatar?: string; subscriberCount: number; onStart: (title: string) => void; onSchedule: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('Study together');
  return <section className="sg-call-shell" aria-label="Set up audio session">
    <header className="sg-call-header"><button className="sg-call-icon" aria-label="Back to chat" onClick={onClose}><ArrowLeft size={21} /></button><span className="text-sm text-white/60">SESSION SETUP</span><AudioWaveform size={21} className="text-violet-300" /></header>
    <main className="sg-call-main"><div className="sg-call-hero"><div className="sg-call-portrait"><Avatar name={channelName} src={channelAvatar} size="xl" /></div><span className="sg-call-eyebrow">BRING YOUR CIRCLE TOGETHER</span><h1>Less typing.<br />More talking.</h1><p className="sg-call-subtitle">{channelName}</p></div>
      <div className="sg-call-roster space-y-5"><label htmlFor="session-name" className="block text-sm font-medium">Give your session a name<Input id="session-name" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} className="mt-3 h-12 rounded-2xl border-white/10 bg-white/5 text-white" /></label>
        <div className="sg-call-setup-note"><Mic size={20} /><p>Your mic starts on. Members join muted and can raise a hand to speak.</p></div><div className="sg-call-setup-note"><Users size={20} /><p>{subscriberCount} members can join. Starting a session notifies your channel or group.</p></div><p className="text-xs leading-relaxed text-white/40">Audio only. Recording is off until you choose to start it with everyone’s permission.</p>
      </div>
    </main><footer className="sg-call-footer"><Button className="h-14 w-full max-w-md rounded-2xl bg-violet-400 text-slate-950 hover:bg-violet-300 font-semibold" disabled={!title.trim()} onClick={() => onStart(title.trim())}><AudioWaveform className="mr-2" size={20} />Start audio session</Button><button className="mt-5 flex items-center justify-center gap-2 text-sm text-white/60" onClick={onSchedule}><Calendar size={17} />Schedule for later</button></footer>
  </section>;
}
