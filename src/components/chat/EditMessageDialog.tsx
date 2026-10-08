import { useEffect, useRef, useState } from 'react';
import { Check, FileText, Loader2, Replace, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageWithSender } from '@/types/chat';
import { toast } from 'sonner';

export function EditMessageDialog({ message, onClose, onSave }: { message: MessageWithSender; onClose: () => void; onSave: (message: MessageWithSender, caption: string, file?: File) => Promise<void> }) {
  const [caption, setCaption] = useState(message.content || '');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) { setPreview(undefined); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const image = file ? file.type.startsWith('image/') : message.message_type === 'image';
  const save = async () => {
    setSaving(true);
    try { await onSave(message, caption, file); toast.success('Message updated'); onClose(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update message.'); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-w-md rounded-3xl max-h-[90dvh] overflow-auto">
      <DialogTitle>{message.file_url ? 'Edit attachment' : 'Edit message'}</DialogTitle>
      <DialogDescription>{message.file_url ? 'Replace the file or update its caption. Replies stay attached to this message.' : 'Update your message.'}</DialogDescription>
      {message.file_url && <div className="rounded-2xl overflow-hidden bg-secondary">
        {image ? <img src={preview || message.file_url} alt="Attachment preview" className="w-full max-h-64 object-contain" /> : <div className="flex items-center gap-3 p-4"><FileText className="h-8 w-8 shrink-0 text-primary" /><span className="break-all text-sm">{file?.name || message.file_name || 'Attachment'}</span></div>}
        <div className="flex gap-2 p-2"><Button variant="secondary" className="flex-1 rounded-xl" disabled={saving} onClick={() => input.current?.click()}><Replace className="h-4 w-4 mr-2" />Replace {image ? 'photo' : 'file'}</Button>{file && <Button variant="ghost" size="icon" aria-label="Undo replacement" disabled={saving} onClick={() => setFile(undefined)}><X className="h-4 w-4" /></Button>}</div>
        <input ref={input} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.mp3,.webm,.ogg,.wav,.mp4,.txt,.doc,.docx" onChange={e => { setFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>}
      <label className="text-sm" htmlFor="edit-caption">{message.file_url ? 'Caption (optional)' : 'Message'}</label>
      <Textarea id="edit-caption" value={caption} onChange={e => setCaption(e.target.value)} disabled={saving} className="rounded-2xl min-h-24" />
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || (!message.file_url && !caption.trim()) || (!file && caption === (message.content || ''))} onClick={save} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}{saving ? 'Saving…' : 'Save changes'}</Button></div>
    </DialogContent>
  </Dialog>;
}
