export function mediaKind(name: string, url = '') {
  const extension = (name.includes('.') ? name : url.split('?')[0]).split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension || '')) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'webm'].includes(extension || '')) return 'audio';
  if (['mp4', 'mov', 'm4v'].includes(extension || '')) return 'video';
  if (['txt', 'md', 'csv'].includes(extension || '')) return 'text';
  return 'file';
}
