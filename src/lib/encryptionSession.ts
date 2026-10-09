import { supabase } from '@/integrations/supabase/client';
import { generateKeyPair, exportPublicKey, getStoredPrivateKey, storePrivateKey, publicKeyFromPrivate, publicKeyIdentity, importPublicKey, deriveSharedKey, encryptMessage, decryptMessage, EncryptionMetadata } from './encryption';
type Session = { privateKey: CryptoKey | null; publicKey: string | null; initialized: boolean; loading: boolean; error: string | null };
const empty: Session = { privateKey: null, publicKey: null, initialized: false, loading: true, error: null };
const signedOut: Session = { ...empty, loading: false };
const sessions = new Map<string, Session>();
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<boolean>>();
// An actual private key + peer public key uniquely identify an ECDH secret.
const sharedKeys = new WeakMap<CryptoKey, Map<string, Promise<CryptoKey>>>();
export const encryptionSnapshot = (id?: string) => id ? sessions.get(id) || empty : signedOut;
export const subscribeEncryption = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function publish(id: string, state: Session) { sessions.set(id, state); listeners.forEach(listener => listener()); }
export async function getRecipientPublicKey(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('user_encryption_keys').select('public_key').eq('user_id', id).maybeSingle();
  if (error) throw new Error('Could not check encryption keys. Please retry when connected.');
  return data?.public_key || null;
}
export function loadEncryption(id: string, create = false): Promise<boolean> {
  const active = pending.get(id);
  if (active) return active;
  const operation = async () => {
    let privateKey: CryptoKey | null = null;
    let publicKey: string | null = null;
    try {
      privateKey = await getStoredPrivateKey(id);
      const remote = await getRecipientPublicKey(id);
      if (privateKey) publicKey = await publicKeyFromPrivate(privateKey);
      if (remote && !privateKey) throw new Error('Encrypted chats need the original device key. This browser does not have it; your existing key has not been replaced.');
      if (remote && publicKey && publicKeyIdentity(remote) !== publicKeyIdentity(publicKey)) throw new Error('This device key differs from your account key. Existing keys are preserved; use the original device to recover encrypted chats.');
      if (!remote && create) {
        if (!privateKey) {
          const pair = await generateKeyPair();
          privateKey = pair.privateKey;
          publicKey = await exportPublicKey(pair.publicKey);
          await storePrivateKey(id, privateKey);
        }
        // INSERT never replaces a key published by another device.
        const { error } = await supabase.from('user_encryption_keys').insert({ user_id: id, public_key: publicKey!, key_created_at: new Date().toISOString() });
        if (error) {
          const latest = await getRecipientPublicKey(id);
          if (!latest || publicKeyIdentity(latest) !== publicKeyIdentity(publicKey!)) throw new Error('Encryption setup changed on another device. No published key was replaced.');
        }
      }
      publish(id, { privateKey, publicKey, initialized: !!privateKey && !!publicKey && (!!remote || create), loading: false, error: null });
      return !!privateKey && !!publicKey && (!!remote || create);
    } catch (error) {
      publish(id, { privateKey, publicKey, initialized: false, loading: false, error: error instanceof Error ? error.message : 'Encryption unavailable' });
      return false;
    }
  };
  const task = (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`studygram-encryption-${id}`, operation) : operation()).finally(() => { pending.delete(id); });
  pending.set(id, task);
  return task;
}
async function sharedKey(privateKey: CryptoKey, peer: string) {
  const identity = publicKeyIdentity(peer);
  let cache = sharedKeys.get(privateKey);
  if (!cache) { cache = new Map(); sharedKeys.set(privateKey, cache); }
  let key = cache.get(identity);
  if (!key) {
    key = importPublicKey(peer).then(publicKey => deriveSharedKey(privateKey, publicKey));
    cache.set(identity, key);
    key.catch(() => cache!.delete(identity));
  }
  return key;
}
export async function encryptForAccount(id: string, recipientId: string, content: string) {
  const session = encryptionSnapshot(id);
  if (!session.privateKey || !session.publicKey || session.error) throw new Error(session.error || 'Encryption is still starting. Please retry.');
  const ownPublished = await getRecipientPublicKey(id);
  if (!ownPublished || publicKeyIdentity(ownPublished) !== publicKeyIdentity(session.publicKey)) throw new Error('Your encryption key changed on another device. Message was not sent.');
  const recipientPublicKey = await getRecipientPublicKey(recipientId);
  if (!recipientPublicKey) throw new Error('This contact has not set up encryption yet. Message was not sent.');
  const { ciphertext, iv } = await encryptMessage(content, await sharedKey(session.privateKey, recipientPublicKey));
  return { encryptedContent: ciphertext, metadata: { iv, senderPublicKey: session.publicKey, recipientPublicKey } };
}
export async function decryptForAccount(id: string, ciphertext: string, metadata: EncryptionMetadata, ownMessage = false, recipientId?: string | null) {
  const { privateKey } = encryptionSnapshot(id);
  if (!privateKey) return null;
  // Older outgoing envelopes omitted the recipient key; current key is best effort.
  const peer = ownMessage ? metadata.recipientPublicKey || (recipientId ? await getRecipientPublicKey(recipientId) : null) : metadata.senderPublicKey;
  if (!peer) return null;
  try { return await decryptMessage(ciphertext, metadata.iv, await sharedKey(privateKey, peer)); }
  catch { return null; }
}
