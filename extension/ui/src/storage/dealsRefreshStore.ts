import {
  ACTIVE_DEALS_REFRESH_INTERVALS,
  type ActiveDealsRefreshInterval,
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
} from '../lib/activeDealsPolling';
import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_KEY = 'veles-deals-refresh-interval-v1';

export const DEALS_REFRESH_OPTIONS = ACTIVE_DEALS_REFRESH_INTERVALS;

export const sanitizeDealsRefreshInterval = (value: unknown): ActiveDealsRefreshInterval => {
  const numeric = typeof value === 'string' ? Number(value) : (value as number);
  if (ACTIVE_DEALS_REFRESH_INTERVALS.includes(numeric as ActiveDealsRefreshInterval)) {
    return numeric as ActiveDealsRefreshInterval;
  }
  return DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL;
};

export const readDealsRefreshInterval = (): ActiveDealsRefreshInterval => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL;
  }
  return sanitizeDealsRefreshInterval(raw);
};

export const writeDealsRefreshInterval = (value: ActiveDealsRefreshInterval): ActiveDealsRefreshInterval => {
  const sanitized = sanitizeDealsRefreshInterval(value);
  writeStorageValue(STORAGE_KEY, String(sanitized));
  return sanitized;
};
