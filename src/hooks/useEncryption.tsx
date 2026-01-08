import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  generateKeyPair,
  exportPublicKey,
  storePrivateKey,
  getStoredPrivateKey,
  hasEncryptionKeys,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  EncryptionMetadata,
} from '@/lib/encryption';

interface UseEncryptionReturn {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initializeEncryption: () => Promise<boolean>;
  encryptForUser: (message: string, recipientUserId: string) => Promise<{
    encryptedContent: string;
    metadata: EncryptionMetadata;
  } | null>;
  decryptMessage: (
    encryptedContent: string,
    metadata: EncryptionMetadata
  ) => Promise<string | null>;
  getRecipientPublicKey: (userId: string) => Promise<string | null>;
}

// Cache for derived shared keys to avoid re-deriving
const sharedKeyCache = new Map<string, CryptoKey>();

export function useEncryption(): UseEncryptionReturn {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<string | null>(null);

  // Check if encryption is already set up
  useEffect(() => {
    const checkEncryptionStatus = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check local storage for private key
        const storedPrivateKey = await getStoredPrivateKey(user.id);
        
        if (storedPrivateKey) {
          setPrivateKey(storedPrivateKey);
          
          // Verify public key exists in database
          const { data } = await supabase
            .from('user_encryption_keys')
            .select('public_key')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (data?.public_key) {
            setPublicKeyJwk(data.public_key);
            setIsInitialized(true);
          }
        }
      } catch (err) {
        console.error('Error checking encryption status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkEncryptionStatus();
  }, [user]);

  // Initialize encryption (generate and store keys)
  const initializeEncryption = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('Must be logged in to initialize encryption');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check if already initialized
      if (await hasEncryptionKeys(user.id)) {
        const existingKey = await getStoredPrivateKey(user.id);
        if (existingKey) {
          setPrivateKey(existingKey);
          setIsInitialized(true);
          return true;
        }
      }

      // Generate new key pair
      console.log('🔐 Generating E2EE key pair...');
      const keyPair = await generateKeyPair();
      
      // Export public key
      const publicKeyExported = await exportPublicKey(keyPair.publicKey);
      
      // Store private key locally
      await storePrivateKey(user.id, keyPair.privateKey);
      
      // Store public key in database
      const { error: dbError } = await supabase
        .from('user_encryption_keys')
        .upsert({
          user_id: user.id,
          public_key: publicKeyExported,
          key_created_at: new Date().toISOString(),
        });

      if (dbError) {
        throw new Error(`Failed to store public key: ${dbError.message}`);
      }

      setPrivateKey(keyPair.privateKey);
      setPublicKeyJwk(publicKeyExported);
      setIsInitialized(true);
      console.log('🔐 E2EE encryption initialized successfully');
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize encryption';
      setError(message);
      console.error('Encryption initialization error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get recipient's public key from database
  const getRecipientPublicKey = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data, error: dbError } = await supabase
        .from('user_encryption_keys')
        .select('public_key')
        .eq('user_id', userId)
        .maybeSingle();

      if (dbError || !data) {
        console.log(`No encryption key found for user ${userId}`);
        return null;
      }

      return data.public_key;
    } catch (err) {
      console.error('Error fetching recipient public key:', err);
      return null;
    }
  }, []);

  // Get or create shared key for a user
  const getSharedKey = useCallback(async (
    otherUserId: string,
    otherPublicKeyJwk: string
  ): Promise<CryptoKey | null> => {
    if (!privateKey || !user) return null;

    const cacheKey = `${user.id}_${otherUserId}`;
    
    // Check cache first
    if (sharedKeyCache.has(cacheKey)) {
      return sharedKeyCache.get(cacheKey)!;
    }

    try {
      const otherPublicKey = await importPublicKey(otherPublicKeyJwk);
      const sharedKey = await deriveSharedKey(privateKey, otherPublicKey);
      sharedKeyCache.set(cacheKey, sharedKey);
      return sharedKey;
    } catch (err) {
      console.error('Error deriving shared key:', err);
      return null;
    }
  }, [privateKey, user]);

  // Encrypt a message for a specific user
  const encryptForUser = useCallback(async (
    message: string,
    recipientUserId: string
  ): Promise<{ encryptedContent: string; metadata: EncryptionMetadata } | null> => {
    if (!privateKey || !user || !publicKeyJwk) {
      console.warn('Encryption not initialized');
      return null;
    }

    try {
      // Get recipient's public key
      const recipientPublicKey = await getRecipientPublicKey(recipientUserId);
      
      if (!recipientPublicKey) {
        console.log(`Recipient ${recipientUserId} has no encryption key, sending unencrypted`);
        return null;
      }

      // Get shared key
      const sharedKey = await getSharedKey(recipientUserId, recipientPublicKey);
      if (!sharedKey) {
        console.error('Failed to derive shared key');
        return null;
      }

      // Encrypt the message
      const { ciphertext, iv } = await encryptMessage(message, sharedKey);

      return {
        encryptedContent: ciphertext,
        metadata: {
          iv,
          senderPublicKey: publicKeyJwk,
        },
      };
    } catch (err) {
      console.error('Encryption error:', err);
      return null;
    }
  }, [privateKey, user, publicKeyJwk, getRecipientPublicKey, getSharedKey]);

  // Decrypt a message
  const decryptMessageContent = useCallback(async (
    encryptedContent: string,
    metadata: EncryptionMetadata
  ): Promise<string | null> => {
    if (!privateKey) {
      console.warn('Cannot decrypt: private key not available');
      return null;
    }

    try {
      // Get shared key using sender's public key
      const sharedKey = await getSharedKey('sender', metadata.senderPublicKey);
      if (!sharedKey) {
        // Try deriving directly
        const senderPublicKey = await importPublicKey(metadata.senderPublicKey);
        const derivedKey = await deriveSharedKey(privateKey, senderPublicKey);
        
        const decrypted = await decryptMessage(encryptedContent, metadata.iv, derivedKey);
        return decrypted;
      }

      const decrypted = await decryptMessage(encryptedContent, metadata.iv, sharedKey);
      return decrypted;
    } catch (err) {
      console.error('Decryption error:', err);
      return null;
    }
  }, [privateKey, getSharedKey]);

  return {
    isInitialized,
    isLoading,
    error,
    initializeEncryption,
    encryptForUser,
    decryptMessage: decryptMessageContent,
    getRecipientPublicKey,
  };
}
