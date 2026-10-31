/**
 * Validation rules for SPILLOUT
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 10;

export const VALID_GENDERS = ['Male', 'Female', 'Object'] as const;
export type Gender = (typeof VALID_GENDERS)[number];

// Display label mappings: Banana -> Male, Peach -> Female, Tomato -> Object
export const GENDER_DISPLAY_MAP: Record<Gender, string> = {
  Male: 'Banana',
  Female: 'Peach',
  Object: 'Tomato',
};

// Approved doodle avatar IDs
export const APPROVED_AVATAR_IDS = new Set([
  'avatar_01', 'avatar_02', 'avatar_03', 'avatar_04',
  'avatar_05', 'avatar_06', 'avatar_07', 'avatar_08',
  'avatar_09', 'avatar_10', 'avatar_11', 'avatar_12',
  'avatar_13', 'avatar_14', 'avatar_15', 'avatar_16',
  'avatar_17', 'avatar_18', 'avatar_19', 'avatar_20',
]);

export interface ValidationResult<T = void> {
  isValid: boolean;
  error?: string;
  data?: T;
}

export interface UsernameValidationData {
  raw: string;
  canonical: string;
}

/**
 * Validates account username:
 * - 3 to 10 characters
 * - Alphanumeric only (letters and digits, no spaces or symbols)
 */
export function validateUsername(raw: unknown): ValidationResult<UsernameValidationData> {
  if (typeof raw !== 'string') {
    return { isValid: false, error: 'Username must be a string' };
  }

  const trimmed = raw.trim();
  if (trimmed.length < MIN_USERNAME_LENGTH || trimmed.length > MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`,
    };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username may only contain letters and numbers (no spaces or special characters)',
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
 * Validates an optional doodle character avatar ID.
 * Allows null/undefined/empty string (no avatar), or an approved avatar ID from the set.
 */
export function validateAvatarId(raw: unknown): ValidationResult<string | null> {
  if (raw === undefined || raw === null || raw === '') {
    return { isValid: true, data: null };
  }

  if (typeof raw !== 'string') {
    return { isValid: false, error: 'Avatar ID must be a string' };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { isValid: true, data: null };
  }

  if (!APPROVED_AVATAR_IDS.has(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid avatar selection. Must be one of the approved doodle characters or null.',
    };
  }

  return { isValid: true, data: trimmed };
}

/**
 * Validates gender selection:
 * Accepts Banana / Peach / Tomato (displayed options) or Male / Female / Object (underlying enums).
 * Normalizes to the canonical storage enum ('Male', 'Female', 'Object').
 */
export function validateGender(raw: unknown): ValidationResult<Gender> {
  if (typeof raw !== 'string') {
    return {
      isValid: false,
      error: 'Gender must be one of: Banana, Peach, Tomato',
    };
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'banana' || normalized === 'male') {
    return { isValid: true, data: 'Male' };
  }
  if (normalized === 'peach' || normalized === 'female') {
    return { isValid: true, data: 'Female' };
  }
  if (normalized === 'tomato' || normalized === 'object') {
    return { isValid: true, data: 'Object' };
  }

  return {
    isValid: false,
    error: 'Gender must be one of: Banana, Peach, Tomato',
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
