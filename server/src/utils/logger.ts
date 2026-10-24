/**
 * Privacy-Preserving Logger for SPILLOUT
 * 
 * Strict architectural rule:
 * - NEVER log message plaintexts, encrypted message payloads, passwords,
 *   private keys, or session tokens.
 */

const REDACTED = '[REDACTED]';

function sanitize(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('ciphertext') ||
      lowerKey.includes('plaintext') ||
      lowerKey.includes('message') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('sdp') ||
      lowerKey.includes('candidate')
    ) {
      cleaned[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitize(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export const logger = {
  info: (message: string, context?: any) => {
    if (context) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, sanitize(context));
    } else {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  },
  warn: (message: string, context?: any) => {
    if (context) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, sanitize(context));
    } else {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    }
  },
  error: (message: string, err?: any) => {
    if (err instanceof Error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}: ${err.message}`);
    } else if (err) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, sanitize(err));
    } else {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    }
  },
  debug: (message: string, context?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      if (context) {
        console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, sanitize(context));
      } else {
        console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
      }
    }
  },
};
