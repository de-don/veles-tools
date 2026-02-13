import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import type { AggregationConfig } from '../types/backtestAggregations';

const STORAGE_KEY = 'veles-backtest-aggregation-config-v1';

type AggregationConfigStore = Record<string, AggregationConfig>;

const readStore = (): AggregationConfigStore => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as AggregationConfigStore;
    }
  } catch (error) {
    console.warn('[Backtest Aggregation Config] Failed to parse stored value', error);
  }
  return {};
};

const writeStore = (store: AggregationConfigStore): void => {
  writeStorageValue(STORAGE_KEY, JSON.stringify(store));
};

export const readAggregationConfig = (groupId: string): AggregationConfig | null => {
  if (!groupId) {
    return null;
  }
  const store = readStore();
  const config = store[groupId];
  if (!config) {
    return null;
  }
  return {
    maxConcurrentPositions: config.maxConcurrentPositions,
    positionBlocking: config.positionBlocking ?? false,
  };
};

export const writeAggregationConfig = (groupId: string, config: AggregationConfig): void => {
  if (!groupId) {
    return;
  }
  const store = readStore();
  store[groupId] = { ...config };
  writeStore(store);
};
