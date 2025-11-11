import {
  type ActiveDealsRefreshInterval,
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  isActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';
import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_KEY = 'veles-active-deals-preferences-v2';
const LEGACY_STORAGE_KEYS = ['veles-active-deals-preferences-v1'];

export interface ActiveDealsPreferences {
  refreshInterval: ActiveDealsRefreshInterval;
  groupByApiKey: boolean;
}

const isActiveDealsPreferences = (value: unknown): value is Partial<ActiveDealsPreferences> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { refreshInterval?: unknown; groupByApiKey?: unknown };
  const refreshValid =
    candidate.refreshInterval === undefined || isActiveDealsRefreshInterval(candidate.refreshInterval);
  const groupValid = candidate.groupByApiKey === undefined || typeof candidate.groupByApiKey === 'boolean';
  return refreshValid && groupValid;
};

export const readActiveDealsPreferences = (): ActiveDealsPreferences | null => {
  let raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      raw = readStorageValue(legacyKey);
      if (raw) {
        break;
      }
    }
    if (!raw) {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isActiveDealsPreferences(parsed)) {
      const refreshInterval = isActiveDealsRefreshInterval(parsed.refreshInterval)
        ? parsed.refreshInterval
        : DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL;
      const groupByApiKey = typeof parsed.groupByApiKey === 'boolean' ? parsed.groupByApiKey : false;
      return {
        refreshInterval,
        groupByApiKey,
      } satisfies ActiveDealsPreferences;
    }
  } catch (error) {
    console.warn('[Veles Tools] Не удалось разобрать настройки активных сделок', error);
  }

  return null;
};

export const writeActiveDealsPreferences = (preferences: ActiveDealsPreferences): ActiveDealsPreferences => {
  const payload: ActiveDealsPreferences = {
    refreshInterval: isActiveDealsRefreshInterval(preferences.refreshInterval)
      ? preferences.refreshInterval
      : DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
    groupByApiKey: Boolean(preferences.groupByApiKey),
  };
  writeStorageValue(STORAGE_KEY, JSON.stringify(payload));
  return payload;
};
