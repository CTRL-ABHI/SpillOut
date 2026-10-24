/**
 * Validation rules for SPILLOUT
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 10;

export const VALID_GENDERS = ['Male', 'Female', 'Object'] as const;
export type Gender = (typeof VALID_GENDERS)[number];

export interface ValidationResult<T = void> {
  isValid: boolean;
  error?: string;
  data?: T;
}

/**
 * Validates a username according to SPILLOUT rules:
 * - Alphanumeric characters only (A-Z, a-z, 0-9)
 * - Length between 3 and 10 characters
 * - No special characters, spaces, punctuation, or emojis
 */
export function validateUsername(raw: unknown): ValidationResult<{ raw: string; canonical: string }> {
  if (typeof raw !== 'string') {
    return { isValid: false, error: 'Username must be a string' };
  }

  const trimmed = raw.trim();
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    };
  }

  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username cannot exceed ${MAX_USERNAME_LENGTH} characters`,
    };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username may only contain letters (A-Z, a-z) and digits (0-9)',
    };
  }

  return {
    isValid: true,
    data: {
      raw: trimmed,
      canonical: trimmed.toLowerCase(),
    },
  };
}

/**
 * Validates gender selection:
 * - Exactly one of "Male", "Female", or "Object"
 */
export function validateGender(raw: unknown): ValidationResult<Gender> {
  if (typeof raw !== 'string' || !VALID_GENDERS.includes(raw as Gender)) {
    return {
      isValid: false,
      error: 'Gender must be one of: Male, Female, Object',
    };
  }

  return {
    isValid: true,
    data: raw as Gender,
  };
}

/**
 * Validates and serializes a 3x3 password matrix:
 * Accepts either:
 * 1. An array of exactly 9 single-character strings (matrix cells)
 * 2. A serialized string of exactly 9 characters
 *
 * NOTE: Whitespace (including spaces) is preserved exactly.
 */
export function validateMatrixPassword(raw: unknown): ValidationResult<string> {
  if (Array.isArray(raw)) {
    if (raw.length !== 9) {
      return {
        isValid: false,
        error: 'Password matrix must contain exactly 9 cells',
      };
    }

    for (let i = 0; i < 9; i++) {
      const cell = raw[i];
      if (typeof cell !== 'string' || cell.length !== 1) {
        return {
          isValid: false,
          error: `Cell ${i + 1} must contain exactly one character`,
        };
      }
    }

    // Row-major order serialization: cell1 + cell2 + ... + cell9
    const serialized = raw.join('');
    return {
      isValid: true,
      data: serialized,
    };
  }

  if (typeof raw === 'string') {
    if (raw.length !== 9) {
      return {
        isValid: false,
        error: 'Password must be exactly 9 characters long',
      };
    }

    return {
      isValid: true,
      data: raw,
    };
  }

  return {
    isValid: false,
    error: 'Password matrix must be an array of 9 characters or a 9-character string',
  };
}
