// Mix all audible participants into one recording without playing the local mic back.
export async function createRecordingMixer(local: MediaStream, remotes: MediaStream[]) {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const sources = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    sources.forEach(source => source.disconnect());
    sources.clear();
    destination.stream.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  };
  const update = (streams: MediaStream[]) => {
    if (disposed) return;
    const tracks = new Set(streams.flatMap(stream => stream.getAudioTracks()).filter(track => track.readyState === 'live'));
    sources.forEach((source, track) => { if (!tracks.has(track)) { source.disconnect(); sources.delete(track); } });
    tracks.forEach(track => {
      if (!sources.has(track)) {
        const source = context.createMediaStreamSource(new MediaStream([track]));
        source.connect(destination); sources.set(track, source);
      }
    });
  };
  try {
    update([local, ...remotes]);
    await context.resume();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    stream: destination.stream,
    update,
    dispose,
  };
}
