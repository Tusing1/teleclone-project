import { useEffect, useRef, useState } from 'react';

export function RemoteAudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;
    audio.srcObject = stream;
    const play = () => { void audio.play().then(() => { if (!disposed) setBlocked(false); }).catch(() => { if (!disposed) setBlocked(true); }); };
    play();
    window.addEventListener('click', play);
    stream.addEventListener('addtrack', play);
    return () => {
      disposed = true;
      window.removeEventListener('click', play);
      stream.removeEventListener('addtrack', play);
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream]);
  return <><audio ref={audioRef} autoPlay playsInline className="hidden" />{blocked && <button className="rounded-full bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={() => { void audioRef.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); }}>Tap to hear call</button>}</>;
}
