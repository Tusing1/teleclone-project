import { AudioSessionView, type AudioSessionProps } from './AudioSessionView';
type LiveStreamViewProps = Omit<AudioSessionProps, 'title' | 'subtitle' | 'avatar' | 'canManage' | 'canStopRecording'> & {
  channelName: string; channelAvatar?: string; streamTitle: string; isAdmin: boolean; isStreamStarter?: boolean; recordedBy?: string | null;
};
export function LiveStreamView({ channelName, channelAvatar, streamTitle, isAdmin, isStreamStarter, recordedBy, ...props }: LiveStreamViewProps) {
  return <AudioSessionView {...props} title={streamTitle} subtitle={channelName} avatar={channelAvatar} canManage={isAdmin || !!isStreamStarter} canStopRecording={recordedBy === props.currentUserId} />;
}
