import { Music2, Pause, Play, X } from 'lucide-react';
import { useGlobalAudio, type AudioSource } from '@/hooks/useGlobalAudio';
import { Button } from '@/components/ui/button';

export function NowPlayingBar({ onOpenSource }: { onOpenSource: (source: AudioSource) => void }) {
  const { audioState, pause, resume, stop } = useGlobalAudio();
  if (!audioState) return null;
  return <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 p-2" aria-label="Now playing">
    <Music2 className="ml-1 h-5 w-5 shrink-0 text-primary" />
    <button disabled={!audioState.source} onClick={() => audioState.source && onOpenSource(audioState.source)} className="min-w-0 flex-1 text-left" aria-label="Open audio conversation">
      <p className="truncate text-xs font-semibold">{audioState.title || 'Audio'}</p><p className="truncate text-[10px] text-muted-foreground">{audioState.source?.label || audioState.channelName || 'Audio player'} · {audioState.isPlaying ? 'Playing' : 'Paused'}</p>
    </button>
    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={audioState.isPlaying ? 'Pause audio' : 'Resume audio'} onClick={audioState.isPlaying ? pause : resume}>{audioState.isPlaying ? <Pause size={16} /> : <Play size={16} />}</Button>
    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Close audio player" onClick={stop}><X size={16} /></Button>
  </div>;
}
