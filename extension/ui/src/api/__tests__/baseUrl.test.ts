import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApiUrl, getApiBaseUrl } from '../baseUrl';

const DEFAULT_ORIGIN = 'https://veles.finance';

describe('baseUrl helpers', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');

  const setLocationOrigin = (origin: string) => {
    Object.defineProperty(globalThis, 'location', {
      value: { origin },
      configurable: true,
    });
  };

  beforeAll(() => {
    if (!originalDescriptor?.configurable) {
      Object.defineProperty(globalThis, 'location', {
        ...originalDescriptor,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'location', originalDescriptor);
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).__VELES_ACTIVE_ORIGIN;
  });

  it('returns location origin when it is http/https', () => {
    setLocationOrigin('https://ru.veles.finance/');

    expect(getApiBaseUrl()).toBe('https://ru.veles.finance');
    expect(buildApiUrl('/api/bots')).toBe('https://ru.veles.finance/api/bots');
  });

  it('falls back to default when origin is extension protocol', () => {
    setLocationOrigin('chrome-extension://abcdef');

    expect(getApiBaseUrl()).toBe(DEFAULT_ORIGIN);
    expect(buildApiUrl('api/bots')).toBe(`${DEFAULT_ORIGIN}/api/bots`);
  });

  it('falls back to default when origin is unavailable', () => {
    setLocationOrigin('');

    expect(getApiBaseUrl()).toBe(DEFAULT_ORIGIN);
  });

  it('prefers stored origin over location', () => {
    setLocationOrigin('chrome-extension://abcdef');
    (globalThis as Record<string, unknown>).__VELES_ACTIVE_ORIGIN = 'https://ru.veles.finance';

    expect(getApiBaseUrl()).toBe('https://ru.veles.finance');
    expect(buildApiUrl('/api/bots')).toBe('https://ru.veles.finance/api/bots');
  });
});
