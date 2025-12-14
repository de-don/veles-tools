import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildBotDetailsUrl, buildCabinetUrl, buildDealStatisticsUrl, buildVelesUrl } from '../cabinetUrls';

const DEFAULT_ORIGIN = 'https://veles.finance';

describe('cabinetUrls helpers', () => {
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');

  const setLocationOrigin = (origin: string) => {
    Object.defineProperty(globalThis, 'location', {
      value: { origin },
      configurable: true,
    });
  };

  beforeAll(() => {
    if (!originalLocationDescriptor?.configurable) {
      Object.defineProperty(globalThis, 'location', {
        ...originalLocationDescriptor,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, 'location', originalLocationDescriptor);
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).__VELES_ACTIVE_ORIGIN;
  });

  it('builds URLs for the active origin from connection state', () => {
    setLocationOrigin('chrome-extension://abcdef');
    (globalThis as Record<string, unknown>).__VELES_ACTIVE_ORIGIN = 'https://ru.veles.finance';

    expect(buildVelesUrl('cabinet')).toBe('https://ru.veles.finance/cabinet');
    expect(buildCabinetUrl('backtests/123')).toBe('https://ru.veles.finance/cabinet/backtests/123');
    expect(buildBotDetailsUrl(42)).toBe('https://ru.veles.finance/cabinet/bot/42');
    expect(buildBotDetailsUrl('42')).toBe('https://ru.veles.finance/cabinet/bot/42');
  });

  it('falls back to the page location when connection state is empty', () => {
    setLocationOrigin('https://ru.veles.finance/');

    expect(buildVelesUrl('share/abc')).toBe('https://ru.veles.finance/share/abc');
    expect(buildDealStatisticsUrl(7)).toBe('https://ru.veles.finance/cabinet/statistics/7');
  });

  it('uses the default origin when neither location nor connection is usable', () => {
    setLocationOrigin('chrome-extension://abcdef');

    expect(buildVelesUrl()).toBe(DEFAULT_ORIGIN);
    expect(buildCabinetUrl()).toBe(`${DEFAULT_ORIGIN}/cabinet`);
  });

  it('normalizes slashes in the provided path', () => {
    setLocationOrigin('https://ru.veles.finance/');

    expect(buildCabinetUrl('/backtests/123/')).toBe('https://ru.veles.finance/cabinet/backtests/123');
    expect(buildVelesUrl('///cabinet///backtests///123///')).toBe('https://ru.veles.finance/cabinet/backtests/123');
  });
});
