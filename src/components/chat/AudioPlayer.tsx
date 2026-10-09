import { ChannelAudioPlayer } from './ChannelAudioPlayer';
import type { AudioSource } from '@/hooks/useGlobalAudio';

// Inbox, channel and viewer audio share one persistent player.
export function AudioPlayer({ url, fileName, className, source }: {
  url: string; fileName?: string; fileSize?: number; className?: string;
  variant?: 'default' | 'compact'; source?: AudioSource;
}) {
  return <ChannelAudioPlayer url={url} title={fileName || 'Voice message'} fileName={fileName} className={className} source={source} channelName={source?.label} />;
}
