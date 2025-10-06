import { readStorageValue, removeStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_PREFIX = 'veles-tools.backtest.';
const MULTI_CURRENCY_ASSET_LIST_KEY = `${STORAGE_PREFIX}multiCurrencyAssetList`;

export const readMultiCurrencyAssetList = (): string => {
  return readStorageValue(MULTI_CURRENCY_ASSET_LIST_KEY) ?? '';
};

export const writeMultiCurrencyAssetList = (value: string): void => {
  writeStorageValue(MULTI_CURRENCY_ASSET_LIST_KEY, value);
};

export const clearMultiCurrencyAssetList = (): void => {
  removeStorageValue(MULTI_CURRENCY_ASSET_LIST_KEY);
};
