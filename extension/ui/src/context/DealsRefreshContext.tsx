import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import type { ActiveDealsRefreshInterval } from '../lib/activeDealsPolling';
import { DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL } from '../lib/activeDealsPolling';
import {
  DEALS_REFRESH_OPTIONS,
  readDealsRefreshInterval,
  writeDealsRefreshInterval,
} from '../storage/dealsRefreshStore';

export interface DealsRefreshContextValue {
  refreshInterval: ActiveDealsRefreshInterval;
  setRefreshInterval: (value: ActiveDealsRefreshInterval) => void;
  defaultInterval: ActiveDealsRefreshInterval;
  options: readonly ActiveDealsRefreshInterval[];
}

const DealsRefreshContext = createContext<DealsRefreshContextValue | undefined>(undefined);

export const DealsRefreshProvider = ({ children }: PropsWithChildren) => {
  const [refreshInterval, setRefreshIntervalState] = useState<ActiveDealsRefreshInterval>(() =>
    readDealsRefreshInterval(),
  );

  const setRefreshInterval = useCallback((value: ActiveDealsRefreshInterval) => {
    const sanitized = writeDealsRefreshInterval(value);
    setRefreshIntervalState(sanitized);
  }, []);

  const value = useMemo<DealsRefreshContextValue>(
    () => ({
      refreshInterval,
      setRefreshInterval,
      defaultInterval: DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
      options: DEALS_REFRESH_OPTIONS,
    }),
    [refreshInterval, setRefreshInterval],
  );

  return <DealsRefreshContext.Provider value={value}>{children}</DealsRefreshContext.Provider>;
};

export const useDealsRefresh = (): DealsRefreshContextValue => {
  const context = useContext(DealsRefreshContext);
  if (!context) {
    throw new Error('useDealsRefresh must be used within a DealsRefreshProvider');
  }
  return context;
};
