import * as argon2 from '@node-rs/argon2';
import { logger } from './logger.js';

/**
 * Password hashing and verification using Argon2id
 * Meets modern production cryptographic recommendations
 */

export async function hashPassword(password: string): Promise<string> {
  try {
    const hashFn = argon2.hash || (argon2 as any).default?.hash;
    const algorithm = argon2.Algorithm?.Argon2id ?? (argon2 as any).default?.Algorithm?.Argon2id ?? 2;

    const hash = await hashFn(password, {
      algorithm,
      memoryCost: 19456, // 19 MiB
      timeCost: 2,       // 2 iterations
      parallelism: 1,
    });

    return hash;
  } catch (err) {
    logger.error('Failed to hash password', err);
    throw new Error('Cryptographic hashing error');
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const verifyFn = argon2.verify || (argon2 as any).default?.verify;
    return await verifyFn(hash, password);
  } catch (err) {
    logger.error('Failed to verify password hash', err);
    return false;
  }
}
