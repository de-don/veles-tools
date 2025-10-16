import { describe, expect, it } from 'vitest';
import { parseNumericInput, sanitizeNumberInput } from '../numericInput';

describe('numeric input helpers', () => {
  it('sanitizes spacing and separators', () => {
    expect(sanitizeNumberInput(' 1 234,56_')).toBe('1234.56');
  });

  it('parses valid numeric strings', () => {
    expect(parseNumericInput('  2500,5 ')).toBe(2500.5);
  });

  it('returns null for invalid numerics', () => {
    expect(parseNumericInput('abc')).toBeNull();
  });
});
