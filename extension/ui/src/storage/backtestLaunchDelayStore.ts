import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_KEY = 'veles-tools.backtest.v2LaunchDelayMs';

export const DEFAULT_V2_BACKTEST_DELAY_MS = 5_000;

const sanitizeDelayValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_V2_BACKTEST_DELAY_MS;
  }

  const normalized = Math.round(value);
  return normalized >= 0 ? normalized : DEFAULT_V2_BACKTEST_DELAY_MS;
};

export const readBacktestV2LaunchDelay = (): number | null => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return sanitizeDelayValue(parsed);
};

export const writeBacktestV2LaunchDelay = (delayMs: number): number => {
  const sanitized = sanitizeDelayValue(delayMs);
  writeStorageValue(STORAGE_KEY, String(sanitized));
  return sanitized;
};

export const normalizeBacktestV2LaunchDelay = (candidate: number): number => {
  return sanitizeDelayValue(candidate);
};
