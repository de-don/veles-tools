export const ACTIVE_DEALS_REFRESH_INTERVALS = [5, 10, 20, 30, 60] as const;

export type ActiveDealsRefreshInterval = (typeof ACTIVE_DEALS_REFRESH_INTERVALS)[number];

export const DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL: ActiveDealsRefreshInterval = 60;

export const isActiveDealsRefreshInterval = (value: unknown): value is ActiveDealsRefreshInterval => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  return (ACTIVE_DEALS_REFRESH_INTERVALS as readonly number[]).includes(value);
};
