import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';
import { EncryptionMetadata } from '@/lib/encryption';
import { encryptionSnapshot, subscribeEncryption, loadEncryption, encryptForAccount, decryptForAccount, getRecipientPublicKey } from '@/lib/encryptionSession';

export function useEncryption() {
  const { user } = useAuth();
  const id = user?.id;
  const state = useSyncExternalStore(subscribeEncryption, () => encryptionSnapshot(id));
  useEffect(() => { if (id) void loadEncryption(id); }, [id]);
  const initializeEncryption = useCallback(() => id ? loadEncryption(id, true) : Promise.resolve(false), [id]);
  const encryptForUser = useCallback((message: string, recipientId: string) => {
    if (!id) return Promise.reject(new Error('Sign in before sending a message.'));
    return encryptForAccount(id, recipientId, message);
  }, [id]);
  const decryptMessage = useCallback((content: string, metadata: EncryptionMetadata, ownMessage = false, recipientId?: string | null) => {
    return id ? decryptForAccount(id, content, metadata, ownMessage, recipientId) : Promise.resolve(null);
  }, [id]);
  return { isInitialized: state.initialized, canDecrypt: !!state.privateKey, isLoading: state.loading, error: state.error, initializeEncryption, encryptForUser, decryptMessage, getRecipientPublicKey };
}
