// Browsers may leave a permission request pending forever when no decision is made.
export async function requestMicrophoneAccess(devices: Pick<MediaDevices, 'getUserMedia'> | undefined, audio: boolean | MediaTrackConstraints = true, timeoutMs = 30000): Promise<MediaStream> {
  if (!devices?.getUserMedia) throw new Error('Microphone access needs HTTPS and a supported browser.');
  let timer: ReturnType<typeof setTimeout>;
  let expired = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { expired = true; reject(new Error('No microphone decision received. Check the browser permission prompt and your device privacy settings, then try again.')); }, timeoutMs);
  });
  try {
    return await Promise.race([
      devices.getUserMedia({ audio, video: false }).then(stream => {
        if (expired) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error('Microphone request expired. Try again.');
        }
        return stream;
      }),
      timeout,
    ]);
  } finally { clearTimeout(timer!); }
}

// Device check only: no call, recording or upload, and every acquired track stops.
export async function checkMicrophoneAccess(devices: Pick<MediaDevices, 'getUserMedia'> | undefined, timeoutMs = 30000) {
  const stream = await requestMicrophoneAccess(devices, true, timeoutMs);
  stream.getTracks().forEach(track => track.stop());
}
