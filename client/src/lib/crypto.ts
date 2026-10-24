/**
 * Real Web Crypto API End-to-End Encryption (E2EE) Module for SPILLOUT
 *
 * Cryptographic Specifications:
 * - Key Agreement: ECDH (Elliptic Curve Diffie-Hellman) over NIST P-256 (secp256r1)
 * - Key Derivation: HKDF-SHA-256
 * - Symmetric Encryption: AES-GCM (256-bit key, 96-bit random IV, 128-bit authentication tag)
 * - Key Fingerprints: SHA-256 digest of participating public keys for safety number verification
 *
 * Memory Isolation:
 * - Ephemeral keys and derived session keys exist ONLY in runtime JavaScript memory.
 * - ZERO persistence to localStorage, sessionStorage, IndexedDB, or cookies.
 */

// Memory cache of ephemeral keys for current browser session
let localIdentityKeyPair: CryptoKeyPair | null = null;
let localPublicKeyBase64: string | null = null;
const derivedKeyCache = new Map<string, CryptoKey>();

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
 * Initialize or get local identity key pair
 */
export async function getOrCreateIdentityKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
}> {
  if (localIdentityKeyPair && localPublicKeyBase64) {
    return { keyPair: localIdentityKeyPair, publicKeyBase64: localPublicKeyBase64 };
  }

  localIdentityKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // Extractable so public key can be shared
    ['deriveKey', 'deriveBits']
  );

  const rawPublic = await window.crypto.subtle.exportKey('raw', localIdentityKeyPair.publicKey);
  localPublicKeyBase64 = arrayBufferToBase64(rawPublic);

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

  // 1. Compute ECDH shared bits
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
      salt: new Uint8Array(), // Domain separation
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

  // Generate fresh 96-bit (12 bytes) IV for every message
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
  senderPublicKeyBase64: string
): Promise<string> {
  const sessionKey = await deriveSharedSessionKey(senderPublicKeyBase64);
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
 * Generate a deterministic safety verification code (fingerprint)
 * based on the two participating public keys
 */
export async function generateSafetyFingerprint(
  localKeyBase64: string,
  remoteKeyBase64: string
): Promise<string> {
  // Sort keys alphabetically so both participants see identical fingerprint
  const sorted = [localKeyBase64, remoteKeyBase64].sort().join('::');
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(sorted)
  );

  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');

  // Format into 4 chunks: XXXX-XXXX-XXXX-XXXX
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/**
 * Completely purge cryptographic state from application memory (called on logout/cleanup)
 */
export function purgeCryptographicMemory(): void {
  localIdentityKeyPair = null;
  localPublicKeyBase64 = null;
  derivedKeyCache.clear();
}
