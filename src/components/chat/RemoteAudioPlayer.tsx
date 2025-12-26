import React, { useEffect, useRef } from 'react';

interface RemoteAudioPlayerProps {
    stream: MediaStream;
}

export const RemoteAudioPlayer: React.FC<RemoteAudioPlayerProps> = ({ stream }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio && stream) {
            console.log('🎵 Setting up remote audio player for stream:', stream.id);

            const playAudio = () => {
                if (audio.srcObject !== stream) {
                    audio.srcObject = stream;
                }
                audio.play().catch(err => {
                    console.log('Audio autoplay blocked or failed:', err);
                });
            };

            playAudio();

            // Ensure we play if tracks are added later
            stream.onaddtrack = () => {
                console.log('🎵 Track added to remote stream, re-playing audio');
                playAudio();
            };

            stream.onremovetrack = () => {
                console.log('🎵 Track removed from remote stream');
            };

            return () => {
                stream.onaddtrack = null;
                stream.onremovetrack = null;
            };
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};
