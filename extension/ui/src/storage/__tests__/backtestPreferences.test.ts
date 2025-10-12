import { describe, expect, it } from 'vitest';
import {
  clearMultiCurrencyAssetList,
  readMultiCurrencyAssetList,
  writeMultiCurrencyAssetList,
} from '../backtestPreferences';

describe('backtestPreferences', () => {
  it('reads empty string when nothing stored', () => {
    window.localStorage.clear();
    expect(readMultiCurrencyAssetList()).toBe('');
  });

  it('persists and clears the multi-currency list', () => {
    window.localStorage.clear();

    writeMultiCurrencyAssetList('BTC,ETH');
    expect(readMultiCurrencyAssetList()).toBe('BTC,ETH');

    clearMultiCurrencyAssetList();
    expect(readMultiCurrencyAssetList()).toBe('');
  });
});
