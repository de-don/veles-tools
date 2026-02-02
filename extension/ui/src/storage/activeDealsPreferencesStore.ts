import {
  type ActiveDealsRefreshInterval,
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  isActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';
import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import type { ActiveDealsChartMode } from '../types/activeDeals';

const STORAGE_KEY = 'veles-active-deals-preferences-v2';
const LEGACY_STORAGE_KEYS = ['veles-active-deals-preferences-v1'];

export interface ActiveDealsPreferences {
  refreshInterval: ActiveDealsRefreshInterval;
  chartMode: ActiveDealsChartMode;
  groupByApiKey?: boolean;
}

const ACTIVE_DEALS_CHART_MODES: ActiveDealsChartMode[] = ['all-deals', 'by-api-key', 'total'];

const isActiveDealsChartMode = (value: unknown): value is ActiveDealsChartMode => {
  return typeof value === 'string' && ACTIVE_DEALS_CHART_MODES.includes(value as ActiveDealsChartMode);
};

const isActiveDealsPreferences = (value: unknown): value is Partial<ActiveDealsPreferences> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { refreshInterval?: unknown; chartMode?: unknown; groupByApiKey?: unknown };
  const refreshValid =
    candidate.refreshInterval === undefined || isActiveDealsRefreshInterval(candidate.refreshInterval);
  const chartModeValid = candidate.chartMode === undefined || isActiveDealsChartMode(candidate.chartMode);
  const groupValid = candidate.groupByApiKey === undefined || typeof candidate.groupByApiKey === 'boolean';
  return refreshValid && chartModeValid && groupValid;
};

const resolveChartMode = (candidate: { chartMode?: unknown; groupByApiKey?: unknown }): ActiveDealsChartMode => {
  if (isActiveDealsChartMode(candidate.chartMode)) {
    return candidate.chartMode;
  }
  if (typeof candidate.groupByApiKey === 'boolean') {
    return candidate.groupByApiKey ? 'by-api-key' : 'total';
  }
  return 'total';
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
      const chartMode = resolveChartMode(parsed);
      return {
        refreshInterval,
        chartMode,
        groupByApiKey: chartMode === 'by-api-key',
      } satisfies ActiveDealsPreferences;
    }
  } catch (error) {
    console.warn('[Veles Tools] Не удалось разобрать настройки активных сделок', error);
  }

  return null;
};

export const writeActiveDealsPreferences = (preferences: ActiveDealsPreferences): ActiveDealsPreferences => {
  const chartMode = isActiveDealsChartMode(preferences.chartMode) ? preferences.chartMode : 'total';
  const payload: ActiveDealsPreferences = {
    refreshInterval: isActiveDealsRefreshInterval(preferences.refreshInterval)
      ? preferences.refreshInterval
      : DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
    chartMode,
    groupByApiKey: chartMode === 'by-api-key',
  };
  writeStorageValue(STORAGE_KEY, JSON.stringify(payload));
  return payload;
};
