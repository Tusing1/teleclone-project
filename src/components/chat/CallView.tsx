import { AudioSessionView, type AudioSessionProps } from './AudioSessionView';
import { useAuth } from '@/hooks/useAuth';
type CallViewProps = Omit<AudioSessionProps, 'title' | 'subtitle' | 'canManage' | 'currentUserId' | 'canStopRecording'> & {
  callType: 'voice'; isCallStarter: boolean; peerName?: string; peerAvatar?: string; recordedBy?: string | null;
};
export function CallView({ isCallStarter, peerName, peerAvatar, recordedBy, ...props }: CallViewProps) {
  const { user } = useAuth();
  const peer = props.participants.find(p => p.user_id !== user?.id);
  return <AudioSessionView {...props} direct title={peerName || peer?.profile?.full_name || peer?.profile?.username || 'Voice call'} avatar={peerAvatar || peer?.profile?.avatar_url || undefined} subtitle="A little less typing. A real conversation." currentUserId={user?.id || ''} canManage={isCallStarter} canStopRecording={recordedBy === user?.id} />;
}
