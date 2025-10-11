import { describe, expect, it, vi } from 'vitest';
import { readStorageValue, removeStorageValue, writeStorageValue } from '../safeStorage';

describe('safeStorage', () => {
  it('writes, reads and removes values', () => {
    window.localStorage.clear();

    expect(readStorageValue('missing')).toBeNull();
    expect(writeStorageValue('foo', 'bar')).toBe(true);
    expect(readStorageValue('foo')).toBe('bar');
    expect(removeStorageValue('foo')).toBe(true);
    expect(readStorageValue('foo')).toBeNull();
  });

  it('gracefully handles inaccessible localStorage', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Access denied');
      },
    });

    try {
      expect(readStorageValue('foo')).toBeNull();
      expect(writeStorageValue('foo', 'bar')).toBe(false);
      expect(removeStorageValue('foo')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- test cleanup
        delete (window as unknown as Record<string, unknown>).localStorage;
      }
      warnSpy.mockRestore();
    }
  });
});
