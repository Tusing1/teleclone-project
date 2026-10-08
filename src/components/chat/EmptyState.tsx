import { FileText, Mic, Radio, Users } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-background px-6 text-center">
      <BrandMark className="mb-6 h-20 w-20 -rotate-6" />
      <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-2">Your study space</p>
      <h2 className="text-4xl font-bold tracking-tight text-foreground mb-3">Good company.<br /><span className="text-primary">Better studying.</span></h2>
      <p className="text-muted-foreground max-w-md mb-7">Pick a conversation, join a channel, or find a study buddy and keep every session in one place.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-xl">
        {[
          { icon: Users, label: 'Groups', hint: 'Work together' },
          { icon: Radio, label: 'Channels', hint: 'Share knowledge' },
          { icon: Mic, label: 'Voice sessions', hint: 'Study live' },
          { icon: FileText, label: 'Shared files', hint: 'Keep resources' },
        ].map(({ icon: Icon, label, hint }) => (
          <div key={label} className="rounded-2xl border border-border/70 bg-card/60 p-3 text-left">
            <Icon className="h-4 w-4 text-primary mb-2" />
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
