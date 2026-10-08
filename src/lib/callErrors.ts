export function callErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || /permission denied/i.test(error.message)) return 'Microphone access is blocked by your device or browser. Allow microphone access there, then try the call again.';
    if (error.name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.';
    if (error.name === 'NotReadableError') return 'The microphone is unavailable. Check whether another app is using it, then try again.';
    return error.message;
  }
  return 'Could not connect. Check your connection and try again.';
}
