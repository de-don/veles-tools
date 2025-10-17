import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ACTIVE_DEALS_DEFAULT_SIZE, fetchAllActiveDeals } from '../api/activeDeals';
import type { ActiveDealMetrics } from '../lib/activeDeals';
import { type ActiveDealsAggregation, aggregateDeals } from '../lib/activeDeals';
import {
  DEAL_HISTORY_LIMIT,
  DEAL_HISTORY_WINDOW_MS,
  clampDealHistory,
  filterDealHistoryByTimeWindow,
  type DealHistoryMap,
  type DealHistoryPoint,
  mapHistoryToSnapshot,
  snapshotHistoryToMap,
} from '../lib/activeDealsHistory';
import { type ActiveDealsRefreshInterval, DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL } from '../lib/activeDealsPolling';
import type { ActiveDealsZoomPreset } from '../lib/activeDealsZoom';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import type { DataZoomRange } from '../lib/chartOptions';
import { readActiveDealsPreferences, writeActiveDealsPreferences } from '../storage/activeDealsPreferencesStore';
import {
  clearActiveDealsSnapshot,
  readActiveDealsSnapshot,
  writeActiveDealsSnapshot,
} from '../storage/activeDealsStore';
import type { ActiveDeal } from '../types/activeDeals';

interface DealsState {
  aggregation: ActiveDealsAggregation | null;
  positions: ActiveDealMetrics[];
  rawDeals: ActiveDeal[];
  totalDeals: number;
  lastUpdated: number | null;
}

const createEmptySeries = (): PortfolioEquitySeries => ({
  points: [],
  minValue: 0,
  maxValue: 0,
});

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
  positionHistory: DealHistoryMap;
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
  const [positionHistory, setPositionHistory] = useState<DealHistoryMap>(() => new Map());

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

      setPositionHistory((prev) => {
        const next = new Map(prev);
        const activeIds = new Set<number>();
        aggregation.positions.forEach((position) => {
          const dealId = position.deal.id;
          activeIds.add(dealId);
          const previous = next.get(dealId) ?? [];
          const filteredPrevious = filterDealHistoryByTimeWindow(previous, DEAL_HISTORY_WINDOW_MS, timestamp);
          const appended = [...filteredPrevious, { time: timestamp, pnl: position.pnl, pnlPercent: position.pnlPercent }];
          const trimmed = clampDealHistory(appended, DEAL_HISTORY_LIMIT);
          next.set(dealId, trimmed);
        });

        Array.from(next.keys()).forEach((dealId) => {
          if (!activeIds.has(dealId)) {
            next.delete(dealId);
          }
        });

        return next;
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
      const deals = await fetchAllActiveDeals({
        size: ACTIVE_DEALS_DEFAULT_SIZE,
      });
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
      setPositionHistory(new Map());
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
    setPositionHistory(new Map());
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
    let historyRestored = false;
    const restoredHistory = snapshotHistoryToMap(snapshot.positionHistory);
    if (restoredHistory.size > 0) {
      const now = Date.now();
      const normalizedHistory: DealHistoryMap = new Map();
      restoredHistory.forEach((points, dealId) => {
        const filteredPoints = filterDealHistoryByTimeWindow(points, DEAL_HISTORY_WINDOW_MS, now);
        const trimmedPoints = clampDealHistory(filteredPoints, DEAL_HISTORY_LIMIT);
        if (trimmedPoints.length > 0) {
          normalizedHistory.set(dealId, trimmedPoints);
        }
      });
      if (normalizedHistory.size > 0) {
        setPositionHistory(normalizedHistory);
        historyRestored = true;
      }
    }
    if (!historyRestored && snapshot.lastUpdated) {
      const history = new Map<number, DealHistoryPoint[]>();
      aggregation.positions.forEach((position) => {
        history.set(position.deal.id, [
          { time: snapshot.lastUpdated ?? 0, pnl: position.pnl, pnlPercent: position.pnlPercent },
        ]);
      });
      setPositionHistory(history);
    }
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
      positionHistory: mapHistoryToSnapshot(positionHistory),
    });
  }, [dealsState.rawDeals, dealsState.lastUpdated, zoomRange, zoomPreset, positionHistory]);

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
      positionHistory,
    }),
    [
      dealsState,
      pnlSeries,
      loading,
      error,
      refreshInterval,
      updateRefreshInterval,
      fetchDeals,
      resetHistory,
      zoomRange,
      zoomPreset,
      positionHistory,
    ],
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
