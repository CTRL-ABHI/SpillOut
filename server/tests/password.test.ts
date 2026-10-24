import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { validateUsername, validateGender, validateMatrixPassword } from '../src/utils/validation.js';

describe('Cryptographic Password and Matrix Validation', () => {
  it('hashes and verifies passwords using Argon2id', async () => {
    const rawPassword = 'A1! B2@ C3#';
    const hash = await hashPassword(rawPassword);

    expect(hash).toContain('$argon2id$');
    const isValid = await verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);

    const isWrong = await verifyPassword('wrong-pwd', hash);
    expect(isWrong).toBe(false);
  });

  it('validates 3x3 password matrix with preserved spaces and symbols', () => {
    // Array of 9 cells: cell 5 is a literal space
    const cells = ['k', 'E', '9', '!', ' ', '@', 'x', '7', '$'];
    const result = validateMatrixPassword(cells);

    expect(result.isValid).toBe(true);
    expect(result.data).toBe('kE9! @x7$');
    expect(result.data?.length).toBe(9);
    expect(result.data?.[4]).toBe(' ');
  });

  it('rejects incomplete matrix passwords', () => {
    const incompleteCells = ['a', 'b', 'c'];
    const result = validateMatrixPassword(incompleteCells);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('9 cells');
  });

  it('enforces username constraints', () => {
    expect(validateUsername('Abhi123').isValid).toBe(true);
    expect(validateUsername('Abhi123').data?.canonical).toBe('abhi123');

    // Rejects too short / too long
    expect(validateUsername('ab').isValid).toBe(false);
    expect(validateUsername('toolongusername123').isValid).toBe(false);

    // Rejects spaces, hyphens, underscores, emojis
    expect(validateUsername('abhi 123').isValid).toBe(false);
    expect(validateUsername('abhi_123').isValid).toBe(false);
    expect(validateUsername('abhi-123').isValid).toBe(false);
    expect(validateUsername('abhi.123').isValid).toBe(false);
    expect(validateUsername('abhi✨').isValid).toBe(false);
  });

  it('validates gender options strictly', () => {
    expect(validateGender('Male').isValid).toBe(true);
    expect(validateGender('Female').isValid).toBe(true);
    expect(validateGender('Object').isValid).toBe(true);
    expect(validateGender('Other').isValid).toBe(false);
    expect(validateGender('NonBinary').isValid).toBe(false);
  });
});
