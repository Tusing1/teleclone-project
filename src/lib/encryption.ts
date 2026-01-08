/**
 * End-to-End Encryption utilities using Web Crypto API
 * Uses ECDH for key exchange and AES-GCM for message encryption
 */

import { get, set, del } from 'idb-keyval';

const PRIVATE_KEY_STORAGE_KEY = 'e2ee_private_key';
const KEY_ALGORITHM = { name: 'ECDH', namedCurve: 'P-256' };
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

// Convert ArrayBuffer to Base64 string
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert Base64 string to ArrayBuffer
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate a new ECDH key pair
export const generateKeyPair = async (): Promise<CryptoKeyPair> => {
  return await crypto.subtle.generateKey(
    KEY_ALGORITHM,
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
};

// Export public key to JWK format for storage
export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
};

// Import public key from JWK format
export const importPublicKey = async (jwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(jwkString);
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    KEY_ALGORITHM,
    true,
    []
  );
};

// Export private key to JWK format for storage
export const exportPrivateKey = async (privateKey: CryptoKey): Promise<string> => {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  return JSON.stringify(jwk);
};

// Import private key from JWK format
export const importPrivateKey = async (jwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(jwkString);
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    KEY_ALGORITHM,
    true,
    ['deriveKey', 'deriveBits']
  );
};

// Derive shared secret using ECDH
export const deriveSharedKey = async (
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> => {
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    { name: ENCRYPTION_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt a message
export const encryptMessage = async (
  message: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    sharedKey,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
};

// Decrypt a message
export const decryptMessage = async (
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> => {
  const encryptedData = base64ToArrayBuffer(ciphertext);
  const ivData = base64ToArrayBuffer(iv);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: new Uint8Array(ivData) },
    sharedKey,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

// Store private key in IndexedDB
export const storePrivateKey = async (userId: string, privateKey: CryptoKey): Promise<void> => {
  const exportedKey = await exportPrivateKey(privateKey);
  await set(`${PRIVATE_KEY_STORAGE_KEY}_${userId}`, exportedKey);
};

// Retrieve private key from IndexedDB
export const getStoredPrivateKey = async (userId: string): Promise<CryptoKey | null> => {
  const exportedKey = await get(`${PRIVATE_KEY_STORAGE_KEY}_${userId}`);
  if (!exportedKey) return null;
  return await importPrivateKey(exportedKey);
};

// Delete private key from IndexedDB
export const deleteStoredPrivateKey = async (userId: string): Promise<void> => {
  await del(`${PRIVATE_KEY_STORAGE_KEY}_${userId}`);
};

// Check if user has encryption keys set up
export const hasEncryptionKeys = async (userId: string): Promise<boolean> => {
  const key = await get(`${PRIVATE_KEY_STORAGE_KEY}_${userId}`);
  return !!key;
};

// Interface for encrypted message metadata
export interface EncryptionMetadata {
  iv: string;
  senderPublicKey: string;
}

// Full encryption flow: encrypt message for a recipient
export const encryptForRecipient = async (
  message: string,
  senderPrivateKey: CryptoKey,
  recipientPublicKeyJwk: string
): Promise<{ encryptedContent: string; metadata: EncryptionMetadata; senderPublicKey: string }> => {
  // Import recipient's public key
  const recipientPublicKey = await importPublicKey(recipientPublicKeyJwk);
  
  // Derive shared key
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);
  
  // Encrypt the message
  const { ciphertext, iv } = await encryptMessage(message, sharedKey);
  
  // Export sender's public key for the recipient to derive the same shared key
  const senderKeyPair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['deriveKey']);
  const senderPublicKey = await exportPublicKey(senderKeyPair.publicKey);
  
  return {
    encryptedContent: ciphertext,
    metadata: { iv, senderPublicKey },
    senderPublicKey,
  };
};

// Full decryption flow: decrypt message from a sender
export const decryptFromSender = async (
  encryptedContent: string,
  metadata: EncryptionMetadata,
  recipientPrivateKey: CryptoKey
): Promise<string> => {
  // Import sender's public key
  const senderPublicKey = await importPublicKey(metadata.senderPublicKey);
  
  // Derive shared key (same as sender used)
  const sharedKey = await deriveSharedKey(recipientPrivateKey, senderPublicKey);
  
  // Decrypt the message
  return await decryptMessage(encryptedContent, metadata.iv, sharedKey);
};
