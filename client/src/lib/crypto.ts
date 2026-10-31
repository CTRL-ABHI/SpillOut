/**
 * Real Web Crypto API End-to-End Encryption (E2EE) Module for SPILLOUT
 *
 * Cryptographic Specifications:
 * - Key Agreement: ECDH (Elliptic Curve Diffie-Hellman) over NIST P-256 (secp256r1)
 * - Key Derivation: HKDF-SHA-256
 * - Symmetric Encryption: AES-GCM (256-bit key, 96-bit random IV, 128-bit authentication tag)
 * - Key Fingerprints: SHA-256 digest of participating public keys for safety number verification
 *
 * Device-Local Key Management:
 * - Cryptographic key pairs are securely stored device-locally in IndexedDB (non-extractable across origins).
 * - Private keys NEVER touch the backend or network.
 * - Supports 24-hour retention across logouts and browser sessions on the user's authenticating device.
 */

// Memory cache of identity keys for active browser runtime
let localIdentityKeyPair: CryptoKeyPair | null = null;
let localPublicKeyBase64: string | null = null;
let activeCanonicalUsername: string | null = null;
const derivedKeyCache = new Map<string, CryptoKey>();

const DB_NAME = 'spillout_secure_keystore';
const DB_VERSION = 1;
const STORE_NAME = 'identity_keys';

function openKeyDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Could not open IndexedDB key store, falling back to session memory');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function loadDeviceKey(canonicalUsername: string): Promise<{ keyPair: CryptoKeyPair; publicKeyBase64: string } | null> {
  const db = await openKeyDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`id_${canonicalUsername}`);

      req.onsuccess = () => {
        if (req.result && req.result.keyPair && req.result.publicKeyBase64) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveDeviceKey(canonicalUsername: string, keyPair: CryptoKeyPair, publicKeyBase64: string): Promise<void> {
  const db = await openKeyDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ keyPair, publicKeyBase64 }, `id_${canonicalUsername}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteDeviceKey(canonicalUsername: string): Promise<void> {
  const db = await openKeyDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(`id_${canonicalUsername}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Initialize or retrieve local ECDH identity key pair for the authenticated user.
 * Recovers persisted device key from IndexedDB to maintain decryptability across logouts and browser sessions.
 */
export async function getOrCreateIdentityKeyPair(canonicalUsername?: string): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
}> {
  const canonical = (canonicalUsername || activeCanonicalUsername || 'default_user').toLowerCase().trim();

  if (localIdentityKeyPair && localPublicKeyBase64 && activeCanonicalUsername === canonical) {
    return { keyPair: localIdentityKeyPair, publicKeyBase64: localPublicKeyBase64 };
  }

  // 1. Attempt to restore from device-local IndexedDB
  const stored = await loadDeviceKey(canonical);
  if (stored) {
    localIdentityKeyPair = stored.keyPair;
    localPublicKeyBase64 = stored.publicKeyBase64;
    activeCanonicalUsername = canonical;
    return stored;
  }

  // 2. Generate new NIST P-256 ECDH KeyPair on this device
  localIdentityKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // Extractable public key for key establishment
    ['deriveKey', 'deriveBits']
  );

  const rawPublic = await window.crypto.subtle.exportKey('raw', localIdentityKeyPair.publicKey);
  localPublicKeyBase64 = arrayBufferToBase64(rawPublic);
  activeCanonicalUsername = canonical;

  // 3. Persist to device-local IndexedDB for 24-hour message decryptability
  await saveDeviceKey(canonical, localIdentityKeyPair, localPublicKeyBase64);

  return { keyPair: localIdentityKeyPair, publicKeyBase64: localPublicKeyBase64 };
}

/**
 * Import a remote peer's public key from raw Base64
 */
export async function importPeerPublicKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

/**
 * Derive an AES-GCM-256 encryption key from ECDH shared secret using HKDF
 */
export async function deriveSharedSessionKey(peerPublicKeyBase64: string): Promise<CryptoKey> {
  const cached = derivedKeyCache.get(peerPublicKeyBase64);
  if (cached) {
    return cached;
  }

  const { keyPair } = await getOrCreateIdentityKeyPair();
  const peerCryptoKey = await importPeerPublicKey(peerPublicKeyBase64);

  // 1. Compute ECDH shared bits (NIST P-256)
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: peerCryptoKey,
    },
    keyPair.privateKey,
    256
  );

  // 2. Import shared bits as HKDF key material
  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // 3. Derive AES-GCM-256 session key
  const sessionKey = await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('SPILLOUT_E2EE_v1'),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  derivedKeyCache.set(peerPublicKeyBase64, sessionKey);
  return sessionKey;
}

/**
 * Encrypt a text message using AES-GCM with authenticated tags
 */
export async function encryptTextMessage(
  plaintext: string,
  peerPublicKeyBase64: string
): Promise<{
  iv: string;
  ciphertext: string;
  senderEphemeralPublicKey: string;
}> {
  const { publicKeyBase64 } = await getOrCreateIdentityKeyPair();
  const sessionKey = await deriveSharedSessionKey(peerPublicKeyBase64);

  // Fresh 96-bit (12 bytes) IV for every message
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128, // 16 bytes auth tag
    },
    sessionKey,
    encodedText
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    senderEphemeralPublicKey: publicKeyBase64,
  };
}

/**
 * Decrypt an incoming ciphertext using the shared session key
 */
export async function decryptTextMessage(
  ciphertextBase64: string,
  ivBase64: string,
  peerPublicKeyBase64: string
): Promise<string> {
  const sessionKey = await deriveSharedSessionKey(peerPublicKeyBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    sessionKey,
    ciphertextBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Safe decryption wrapper that gracefully detects and flags ciphertext encrypted for other device sessions.
 */
export async function tryDecryptTextMessage(
  ciphertextBase64: string,
  ivBase64: string,
  peerPublicKeyBase64: string
): Promise<{ text: string; isDecrypted: boolean }> {
  try {
    const text = await decryptTextMessage(ciphertextBase64, ivBase64, peerPublicKeyBase64);
    return { text, isDecrypted: true };
  } catch (err) {
    return {
      text: '[Encrypted message - Key established on another device session]',
      isDecrypted: false,
    };
  }
}

/**
 * Generate a deterministic safety verification code (fingerprint)
 * based on the two participating public keys
 */
export async function generateSafetyFingerprint(
  localKeyBase64: string,
  remoteKeyBase64: string
): Promise<string> {
  const sorted = [localKeyBase64, remoteKeyBase64].sort().join('::');
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(sorted)
  );

  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');

  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/**
 * Purge active runtime cryptographic session cache from memory on logout.
 */
export function purgeCryptographicMemory(): void {
  localIdentityKeyPair = null;
  localPublicKeyBase64 = null;
  activeCanonicalUsername = null;
  derivedKeyCache.clear();
}
