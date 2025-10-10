import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import {
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  type ActiveDealsRefreshInterval,
  isActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';

const STORAGE_KEY = 'veles-active-deals-preferences-v1';

export interface ActiveDealsPreferences {
  refreshInterval: ActiveDealsRefreshInterval;
}

const isActiveDealsPreferences = (value: unknown): value is ActiveDealsPreferences => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { refreshInterval?: unknown };
  return isActiveDealsRefreshInterval(candidate.refreshInterval);
};

export const readActiveDealsPreferences = (): ActiveDealsPreferences | null => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isActiveDealsPreferences(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('[Veles Tools] Не удалось разобрать настройки активных сделок', error);
  }

  return null;
};

export const writeActiveDealsPreferences = (
  preferences: ActiveDealsPreferences,
): ActiveDealsPreferences => {
  const payload: ActiveDealsPreferences = {
    refreshInterval: isActiveDealsRefreshInterval(preferences.refreshInterval)
      ? preferences.refreshInterval
      : DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  };
  writeStorageValue(STORAGE_KEY, JSON.stringify(payload));
  return payload;
};
