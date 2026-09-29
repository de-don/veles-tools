import { describe, expect, it } from 'vitest';
import {
  formatReinvestInput,
  isFuturesExchange,
  isReinvestEnabled,
  parseReinvestInput,
  REINVEST_MAX_PERCENT_FUTURES,
  REINVEST_MAX_PERCENT_SPOT,
  resolveReinvestMaxPercent,
} from '../reinvest';

describe('reinvest helpers', () => {
  it('detects futures exchanges', () => {
    expect(isFuturesExchange('BINANCE_FUTURES')).toBe(true);
    expect(isFuturesExchange('BYBIT_FUTURES')).toBe(true);
    expect(isFuturesExchange('BINANCE')).toBe(false);
    expect(isFuturesExchange('OKX_SPOT')).toBe(false);
    expect(isFuturesExchange(null)).toBe(false);
  });

  it('resolves the max percent for a set of exchanges', () => {
    expect(resolveReinvestMaxPercent(['BINANCE', 'OKX_SPOT'])).toBe(REINVEST_MAX_PERCENT_SPOT);
    expect(resolveReinvestMaxPercent(['BINANCE', 'BYBIT_FUTURES'])).toBe(REINVEST_MAX_PERCENT_FUTURES);
    expect(resolveReinvestMaxPercent([])).toBe(REINVEST_MAX_PERCENT_FUTURES);
  });

  it('treats any finite percent as enabled', () => {
    expect(isReinvestEnabled(20)).toBe(true);
    expect(isReinvestEnabled(null)).toBe(false);
    expect(isReinvestEnabled(undefined)).toBe(false);
    expect(formatReinvestInput(12.5)).toBe('12.5');
    expect(formatReinvestInput(null)).toBe('');
  });

  it('parses and validates the form input', () => {
    expect(parseReinvestInput(false, 'abc', 50)).toEqual({ ok: true, value: null });
    expect(parseReinvestInput(true, '0,5', 50)).toEqual({ ok: true, value: 0.5 });
    expect(parseReinvestInput(true, '50', 50)).toEqual({ ok: true, value: 50 });
    expect(parseReinvestInput(true, '51', 50).ok).toBe(false);
    expect(parseReinvestInput(true, '0.4', 100).ok).toBe(false);
    expect(parseReinvestInput(true, '', 100).ok).toBe(false);
  });
});
