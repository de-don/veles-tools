import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { fetchAllActiveDeals, ACTIVE_DEALS_DEFAULT_SIZE } from '../api/activeDeals';
import { aggregateDeals, type ActiveDealsAggregation } from '../lib/activeDeals';
import type { ActiveDealMetrics } from '../lib/activeDeals';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import type { DataZoomRange } from '../lib/chartOptions';
import type { ActiveDeal } from '../types/activeDeals';
import {
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  type ActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';
import {
  readActiveDealsPreferences,
  writeActiveDealsPreferences,
} from '../storage/activeDealsPreferencesStore';
import {
  clearActiveDealsSnapshot,
  readActiveDealsSnapshot,
  writeActiveDealsSnapshot,
} from '../storage/activeDealsStore';
import type { ActiveDealsZoomPreset } from '../lib/activeDealsZoom';

interface DealsState {
  aggregation: ActiveDealsAggregation | null;
  positions: ActiveDealMetrics[];
  rawDeals: ActiveDeal[];
  totalDeals: number;
  lastUpdated: number | null;
}

const createEmptySeries = (): PortfolioEquitySeries => ({ points: [], minValue: 0, maxValue: 0 });

const buildSeriesWithPoint = (
  current: PortfolioEquitySeries | null,
  value: number,
  timestamp: number,
): PortfolioEquitySeries => {
  const base = current ?? createEmptySeries();
  const nextPoints = [...base.points, { time: timestamp, value }];
  if (nextPoints.length === 0) {
    return createEmptySeries();
  }
  const values = nextPoints.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return { points: nextPoints, minValue, maxValue };
};

const INITIAL_DEALS_STATE: DealsState = {
  aggregation: null,
  positions: [],
  rawDeals: [],
  totalDeals: 0,
  lastUpdated: null,
};

export interface ActiveDealsContextValue {
  dealsState: DealsState;
  pnlSeries: PortfolioEquitySeries;
  loading: boolean;
  error: string | null;
  refreshInterval: ActiveDealsRefreshInterval;
  setRefreshInterval: (interval: ActiveDealsRefreshInterval) => void;
  fetchDeals: () => Promise<void>;
  resetHistory: () => void;
  zoomRange: DataZoomRange | undefined;
  setZoomRange: Dispatch<SetStateAction<DataZoomRange | undefined>>;
  zoomPreset: ActiveDealsZoomPreset;
  setZoomPreset: Dispatch<SetStateAction<ActiveDealsZoomPreset>>;
}

const ActiveDealsContext = createContext<ActiveDealsContextValue | undefined>(undefined);

interface ActiveDealsProviderProps {
  children: ReactNode;
  extensionReady: boolean;
}

export const ActiveDealsProvider = ({ children, extensionReady }: ActiveDealsProviderProps) => {
  const [refreshInterval, setRefreshIntervalState] = useState<ActiveDealsRefreshInterval>(() => {
    const preferences = readActiveDealsPreferences();
    return preferences?.refreshInterval ?? DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL;
  });
  const [dealsState, setDealsState] = useState<DealsState>(INITIAL_DEALS_STATE);
  const [pnlSeries, setPnlSeries] = useState<PortfolioEquitySeries>(() => createEmptySeries());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const [zoomPreset, setZoomPreset] = useState<ActiveDealsZoomPreset>('all');

  const timerRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);
  const seriesRef = useRef<PortfolioEquitySeries>(createEmptySeries());

  useEffect(() => {
    seriesRef.current = pnlSeries;
  }, [pnlSeries]);

  useEffect(() => {
    writeActiveDealsPreferences({ refreshInterval });
  }, [refreshInterval]);

  const resetPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const appendSeriesPoint = useCallback((value: number, timestamp: number) => {
    const nextSeries = buildSeriesWithPoint(seriesRef.current, value, timestamp);
    seriesRef.current = nextSeries;
    setPnlSeries(nextSeries);
  }, []);

  const handleDealsResponse = useCallback(
    (deals: ActiveDeal[], aggregation: ActiveDealsAggregation, timestamp: number) => {
      appendSeriesPoint(aggregation.totalPnl, timestamp);
      setDealsState({
        aggregation,
        positions: aggregation.positions,
        rawDeals: deals,
        totalDeals: deals.length,
        lastUpdated: timestamp,
      });
    },
    [appendSeriesPoint],
  );

  const fetchDeals = useCallback(async () => {
    if (!extensionReady) {
      return;
    }

    setError(null);
    if (!initialLoadRef.current) {
      setLoading(true);
    }

    try {
      const deals = await fetchAllActiveDeals({ size: ACTIVE_DEALS_DEFAULT_SIZE });
      const aggregation = aggregateDeals(deals);
      const timestamp = Date.now();
      handleDealsResponse(deals, aggregation, timestamp);
      initialLoadRef.current = true;
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [extensionReady, handleDealsResponse]);

  useEffect(() => {
    if (!extensionReady) {
      resetPolling();
      const emptySeries = createEmptySeries();
      seriesRef.current = emptySeries;
      setDealsState(INITIAL_DEALS_STATE);
      setPnlSeries(emptySeries);
      setZoomRange(undefined);
      setZoomPreset('all');
      initialLoadRef.current = false;
      setLoading(false);
      setError(null);
      return;
    }

    fetchDeals().catch(() => {
      // error handled inside fetchDeals
    });

    resetPolling();
    timerRef.current = window.setInterval(() => {
      fetchDeals().catch(() => {
        // errors handled
      });
    }, refreshInterval * 1000);

    return () => {
      resetPolling();
    };
  }, [extensionReady, fetchDeals, refreshInterval, resetPolling]);

  useEffect(() => {
    return () => {
      resetPolling();
    };
  }, [resetPolling]);

  const resetHistory = useCallback(() => {
    clearActiveDealsSnapshot();
    const emptySeries = createEmptySeries();
    seriesRef.current = emptySeries;
    setPnlSeries(emptySeries);
    setDealsState(INITIAL_DEALS_STATE);
    setZoomRange(undefined);
    setZoomPreset('all');
    initialLoadRef.current = false;
    setError(null);
  }, []);

  useEffect(() => {
    const snapshot = readActiveDealsSnapshot();
    if (!snapshot) {
      return;
    }

    const aggregation = aggregateDeals(snapshot.deals);
    seriesRef.current = snapshot.series;
    setPnlSeries(snapshot.series);
    setDealsState({
      aggregation,
      positions: aggregation.positions,
      rawDeals: snapshot.deals,
      totalDeals: snapshot.deals.length,
      lastUpdated: snapshot.lastUpdated,
    });
    setZoomRange(snapshot.zoomRange ?? undefined);
    setZoomPreset(snapshot.zoomPreset ?? 'all');
    initialLoadRef.current = snapshot.deals.length > 0;
  }, []);

  useEffect(() => {
    if (dealsState.rawDeals.length === 0) {
      return;
    }
    writeActiveDealsSnapshot({
      deals: dealsState.rawDeals,
      series: seriesRef.current,
      zoomRange,
      zoomPreset,
      lastUpdated: dealsState.lastUpdated,
      storedAt: Date.now(),
    });
  }, [dealsState.rawDeals, dealsState.lastUpdated, zoomRange, zoomPreset]);

  const updateRefreshInterval = useCallback((interval: ActiveDealsRefreshInterval) => {
    setRefreshIntervalState(interval);
  }, []);

  const contextValue = useMemo<ActiveDealsContextValue>(
    () => ({
      dealsState,
      pnlSeries,
      loading,
      error,
      refreshInterval,
      setRefreshInterval: updateRefreshInterval,
      fetchDeals,
      resetHistory,
      zoomRange,
      setZoomRange,
      zoomPreset,
      setZoomPreset,
    }),
    [dealsState, pnlSeries, loading, error, refreshInterval, updateRefreshInterval, fetchDeals, resetHistory, zoomRange, zoomPreset],
  );

  return <ActiveDealsContext.Provider value={contextValue}>{children}</ActiveDealsContext.Provider>;
};

export const useActiveDeals = (): ActiveDealsContextValue => {
  const context = useContext(ActiveDealsContext);
  if (!context) {
    throw new Error('useActiveDeals must be used within an ActiveDealsProvider');
  }
  return context;
};

