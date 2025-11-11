import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_KEY = 'veles-backtest-limit-analysis-v1';

export interface LimitAnalysisPreferences {
  maxLimit: number;
}

type LimitAnalysisStore = Record<string, LimitAnalysisPreferences>;

const readStore = (): LimitAnalysisStore => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as LimitAnalysisStore;
    }
  } catch (error) {
    console.warn('[Backtest Limit Analysis Store] Failed to parse stored value', error);
  }
  return {};
};

const writeStore = (store: LimitAnalysisStore): void => {
  writeStorageValue(STORAGE_KEY, JSON.stringify(store));
};

export const readLimitAnalysisPreferences = (groupId: string): LimitAnalysisPreferences | null => {
  if (!groupId) {
    return null;
  }
  const store = readStore();
  const entry = store[groupId];
  if (!entry) {
    return null;
  }
  return { maxLimit: entry.maxLimit };
};

export const writeLimitAnalysisPreferences = (groupId: string, preferences: LimitAnalysisPreferences): void => {
  if (!groupId) {
    return;
  }
  const store = readStore();
  store[groupId] = { ...preferences };
  writeStore(store);
};
