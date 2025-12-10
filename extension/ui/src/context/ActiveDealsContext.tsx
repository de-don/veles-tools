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
import { fetchApiKeys } from '../api/apiKeys';
import type { ActiveDealMetrics, ExecutedOrdersIndex } from '../lib/activeDeals';
import { type ActiveDealsAggregation, aggregateDeals, buildExecutedOrdersIndex } from '../lib/activeDeals';
import {
  ACTIVE_DEALS_HISTORY_POINT_LIMIT,
  buildPortfolioEquitySeries,
  createEmptyPortfolioEquitySeries,
  DEAL_HISTORY_WINDOW_MS,
  type DealHistoryMap,
  type ExecutedOrdersHistoryMap,
  filterDealHistoryByTimeWindow,
  getSeriesStartTimestamp,
  mergeExecutedOrdersHistory,
} from '../lib/activeDealsHistory';
import { type ActiveDealsRefreshInterval, DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL } from '../lib/activeDealsPolling';
import type { ActiveDealsZoomPreset } from '../lib/activeDealsZoom';
import type { DataZoomRange } from '../lib/chartOptions';
import type {
  ExecutedOrderPoint,
  PortfolioEquityGroupedSeriesItem,
  PortfolioEquitySeries,
} from '../lib/deprecatedFile';
import {
  clearActiveDealsHistoryCache,
  readActiveDealsHistoryCache,
  writeActiveDealsHistoryCache,
} from '../storage/activeDealsHistoryStore';
import {
  type ActiveDealsPreferences,
  readActiveDealsPreferences,
  writeActiveDealsPreferences,
} from '../storage/activeDealsPreferencesStore';
import type { ActiveDeal } from '../types/activeDeals';
import type { ApiKey } from '../types/apiKeys';

interface DealsState {
  aggregation: ActiveDealsAggregation | null;
  positions: ActiveDealMetrics[];
  rawDeals: ActiveDeal[];
  totalDeals: number;
  lastUpdated: number | null;
}

const createEmptySeries = createEmptyPortfolioEquitySeries;

type GroupedSeriesMap = Map<number, PortfolioEquitySeries>;
type ApiKeyMap = Map<number, ApiKey>;

const buildApiKeyLabel = (apiKeyId: number, apiKey: ApiKey | undefined, deal?: ActiveDeal): string => {
  const keyName = typeof apiKey?.name === 'string' ? apiKey.name.trim() : '';
  if (keyName) {
    return keyName;
  }
  const exchange = apiKey?.exchange ?? deal?.exchange ?? deal?.pair?.exchange;
  if (exchange) {
    return `API ключ ${apiKeyId} · ${exchange}`;
  }
  return `API ключ ${apiKeyId}`;
};

const buildSeriesWithPoint = (
  current: PortfolioEquitySeries | null,
  value: number,
  timestamp: number,
): PortfolioEquitySeries => {
  const basePoints = current?.points ?? [];
  return buildPortfolioEquitySeries([...basePoints, { time: timestamp, value }]);
};

const composeGroupedSeries = (
  seriesMap: GroupedSeriesMap,
  samples: Map<number, ActiveDeal>,
  apiKeys: ApiKeyMap,
): PortfolioEquityGroupedSeriesItem[] => {
  return Array.from(seriesMap.entries())
    .sort(([leftId], [rightId]) => leftId - rightId)
    .map(([apiKeyId, series]) => {
      const apiKey = apiKeys.get(apiKeyId);
      return {
        id: String(apiKeyId),
        label: buildApiKeyLabel(apiKeyId, apiKey, samples.get(apiKeyId)),
        series,
        apiKeyId,
      };
    });
};

const buildExecutedOrdersIndexFromHistory = (history: ExecutedOrdersHistoryMap): ExecutedOrdersIndex => {
  const byDeal: ExecutedOrdersIndex['byDeal'] = new Map();
  const all: ExecutedOrderPoint[] = [];

  history.forEach((orders, dealId) => {
    const sorted = [...orders].sort((left, right) => left.time - right.time);
    if (sorted.length > 0) {
      byDeal.set(dealId, sorted);
      all.push(...sorted);
    }
  });

  all.sort((left, right) => left.time - right.time);

  return { byDeal, all };
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
  groupedPnlSeries: PortfolioEquityGroupedSeriesItem[];
  groupByApiKey: boolean;
  setGroupByApiKey: Dispatch<SetStateAction<boolean>>;
  apiKeysById: ApiKeyMap;
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
  executedOrders: ExecutedOrderPoint[];
  executedOrdersByDeal: Map<number, ExecutedOrderPoint[]>;
}

const ActiveDealsContext = createContext<ActiveDealsContextValue | undefined>(undefined);

interface ActiveDealsProviderProps {
  children: ReactNode;
  extensionReady: boolean;
}

export const ActiveDealsProvider = ({ children, extensionReady }: ActiveDealsProviderProps) => {
  const initialPreferencesRef = useRef<ActiveDealsPreferences | null | undefined>(undefined);
  if (initialPreferencesRef.current === undefined) {
    initialPreferencesRef.current = readActiveDealsPreferences();
  }
  const initialPreferences = initialPreferencesRef.current ?? null;
  const cachedSeries = createEmptySeries();
  const initialGroupedSeries: GroupedSeriesMap = new Map();
  const initialPositionHistory: DealHistoryMap = new Map();

  const [refreshInterval, setRefreshIntervalState] = useState<ActiveDealsRefreshInterval>(
    () => initialPreferences?.refreshInterval ?? DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  );
  const [dealsState, setDealsState] = useState<DealsState>(INITIAL_DEALS_STATE);
  const [pnlSeries, setPnlSeries] = useState<PortfolioEquitySeries>(() => cachedSeries);
  const [groupedPnlSeries, setGroupedPnlSeries] = useState<PortfolioEquityGroupedSeriesItem[]>(() =>
    composeGroupedSeries(initialGroupedSeries, new Map(), new Map()),
  );
  const [groupByApiKey, setGroupByApiKeyState] = useState<boolean>(() => initialPreferences?.groupByApiKey ?? false);
  const [apiKeysById, setApiKeysById] = useState<ApiKeyMap>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const [zoomPreset, setZoomPreset] = useState<ActiveDealsZoomPreset>('all');
  const [positionHistory, setPositionHistory] = useState<DealHistoryMap>(() => initialPositionHistory);
  const [executedOrdersIndex, setExecutedOrdersIndex] = useState<ExecutedOrdersIndex>(() => ({
    byDeal: new Map(),
    all: [],
  }));

  const timerRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);
  const seriesRef = useRef<PortfolioEquitySeries>(cachedSeries);
  const groupedSeriesRef = useRef<GroupedSeriesMap>(new Map(initialGroupedSeries));
  const groupedSamplesRef = useRef<Map<number, ActiveDeal>>(new Map());
  const apiKeysRef = useRef<ApiKeyMap>(new Map());
  const positionHistoryRef = useRef<DealHistoryMap>(new Map(initialPositionHistory));
  const executedOrdersHistoryRef = useRef<ExecutedOrdersHistoryMap>(new Map());
  const isLoadingApiKeysRef = useRef(false);

  const syncGroupedSeries = useCallback(() => {
    setGroupedPnlSeries(composeGroupedSeries(groupedSeriesRef.current, groupedSamplesRef.current, apiKeysRef.current));
  }, []);

  useEffect(() => {
    seriesRef.current = pnlSeries;
  }, [pnlSeries]);

  useEffect(() => {
    positionHistoryRef.current = positionHistory;
  }, [positionHistory]);

  useEffect(() => {
    writeActiveDealsPreferences({ refreshInterval, groupByApiKey });
  }, [refreshInterval, groupByApiKey]);

  useEffect(() => {
    let cancelled = false;

    readActiveDealsHistoryCache()
      .then((cache) => {
        if (cancelled || !cache) {
          return;
        }
        seriesRef.current = cache.pnlSeries;
        setPnlSeries(cache.pnlSeries);

        groupedSeriesRef.current = cache.groupedSeries;
        setGroupedPnlSeries(composeGroupedSeries(cache.groupedSeries, groupedSamplesRef.current, apiKeysRef.current));

        positionHistoryRef.current = cache.positionHistory;
        setPositionHistory(cache.positionHistory);

        executedOrdersHistoryRef.current = cache.executedOrders;
        setExecutedOrdersIndex(buildExecutedOrdersIndexFromHistory(cache.executedOrders));
      })
      .catch((error) => {
        console.warn('[Veles Tools] Не удалось загрузить кэш истории активных сделок', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resetPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const appendSeriesPoint = useCallback((value: number, timestamp: number): PortfolioEquitySeries => {
    const nextSeries = buildSeriesWithPoint(seriesRef.current, value, timestamp);
    seriesRef.current = nextSeries;
    setPnlSeries(nextSeries);
    return nextSeries;
  }, []);

  const updateGroupedSeries = useCallback(
    (
      totalsByApiKey: Map<number, number>,
      dealSamples: Map<number, ActiveDeal>,
      timestamp: number,
    ): GroupedSeriesMap => {
      const activeApiKeyIds = new Set<number>();
      const nextSeriesMap: GroupedSeriesMap = new Map(groupedSeriesRef.current);
      const nextSamples = new Map(groupedSamplesRef.current);

      totalsByApiKey.forEach((pnl, apiKeyId) => {
        activeApiKeyIds.add(apiKeyId);
        const currentSeries = nextSeriesMap.get(apiKeyId) ?? null;
        const nextSeries = buildSeriesWithPoint(currentSeries, pnl, timestamp);
        nextSeriesMap.set(apiKeyId, nextSeries);
        const sampleDeal = dealSamples.get(apiKeyId);
        if (sampleDeal) {
          nextSamples.set(apiKeyId, sampleDeal);
        }
      });

      nextSeriesMap.forEach((_series, apiKeyId) => {
        if (!activeApiKeyIds.has(apiKeyId)) {
          nextSeriesMap.delete(apiKeyId);
          nextSamples.delete(apiKeyId);
        }
      });

      groupedSeriesRef.current = nextSeriesMap;
      groupedSamplesRef.current = nextSamples;
      syncGroupedSeries();
      return nextSeriesMap;
    },
    [syncGroupedSeries],
  );

  const persistActiveDealsHistory = useCallback(
    (
      series: PortfolioEquitySeries,
      groupedSeries: GroupedSeriesMap,
      history: DealHistoryMap,
      executedOrders: ExecutedOrdersHistoryMap,
    ) => {
      void writeActiveDealsHistoryCache({
        pnlSeries: series,
        groupedSeries,
        positionHistory: history,
        executedOrders,
      });
    },
    [],
  );

  const loadApiKeys = useCallback(async () => {
    if (isLoadingApiKeysRef.current) {
      return;
    }
    isLoadingApiKeysRef.current = true;
    try {
      const apiKeys = await fetchApiKeys({ size: 200 });
      const next = new Map<number, ApiKey>();
      apiKeys.forEach((key) => {
        next.set(key.id, key);
      });
      apiKeysRef.current = next;
      setApiKeysById(next);
    } catch (requestError: unknown) {
      console.warn('[Veles Tools] Не удалось загрузить список API-ключей', requestError);
    } finally {
      isLoadingApiKeysRef.current = false;
    }
  }, []);

  const updatePositionHistory = useCallback(
    (positions: ActiveDealsAggregation['positions'], timestamp: number): DealHistoryMap => {
      const next = new Map(positionHistoryRef.current);
      const activeIds = new Set<number>();

      positions.forEach((position) => {
        const dealId = position.deal.id;
        activeIds.add(dealId);
        const previous = next.get(dealId) ?? [];
        const filteredPrevious = filterDealHistoryByTimeWindow(previous, DEAL_HISTORY_WINDOW_MS, timestamp);
        const appended = [...filteredPrevious, { time: timestamp, pnl: position.pnl, pnlPercent: position.pnlPercent }];
        next.set(dealId, appended);
      });

      Array.from(next.keys()).forEach((dealId) => {
        if (!activeIds.has(dealId)) {
          next.delete(dealId);
        }
      });

      positionHistoryRef.current = next;
      setPositionHistory(next);
      return next;
    },
    [],
  );

  const handleDealsResponse = useCallback(
    (deals: ActiveDeal[], aggregation: ActiveDealsAggregation, timestamp: number) => {
      const nextSeries = appendSeriesPoint(aggregation.totalPnl, timestamp);
      const historyStart = getSeriesStartTimestamp(nextSeries);

      const totalsByApiKey = new Map<number, number>();
      const dealSamples = new Map<number, ActiveDeal>();
      let shouldReloadApiKeys = false;

      aggregation.positions.forEach((position) => {
        const apiKeyId = position.deal.apiKeyId;
        totalsByApiKey.set(apiKeyId, (totalsByApiKey.get(apiKeyId) ?? 0) + position.pnl);
        if (!dealSamples.has(apiKeyId)) {
          dealSamples.set(apiKeyId, position.deal);
        }
        if (!apiKeysRef.current.has(apiKeyId)) {
          shouldReloadApiKeys = true;
        }
      });

      if (shouldReloadApiKeys) {
        loadApiKeys().catch(() => {
          // error logged inside loadApiKeys
        });
      }

      const nextGroupedSeries = updateGroupedSeries(totalsByApiKey, dealSamples, timestamp);
      setDealsState({
        aggregation,
        positions: aggregation.positions,
        rawDeals: deals,
        totalDeals: deals.length,
        lastUpdated: timestamp,
      });

      const nextPositionHistory = updatePositionHistory(aggregation.positions, timestamp);
      const incomingExecutedOrders = buildExecutedOrdersIndex(deals);
      const nextExecutedOrdersHistory = mergeExecutedOrdersHistory(
        executedOrdersHistoryRef.current,
        incomingExecutedOrders.byDeal,
        historyStart,
        ACTIVE_DEALS_HISTORY_POINT_LIMIT,
      );
      executedOrdersHistoryRef.current = nextExecutedOrdersHistory;
      setExecutedOrdersIndex(buildExecutedOrdersIndexFromHistory(nextExecutedOrdersHistory));

      persistActiveDealsHistory(nextSeries, nextGroupedSeries, nextPositionHistory, nextExecutedOrdersHistory);
    },
    [
      appendSeriesPoint,
      loadApiKeys,
      persistActiveDealsHistory,
      updateGroupedSeries,
      updatePositionHistory,
      mergeExecutedOrdersHistory,
      buildExecutedOrdersIndex,
      getSeriesStartTimestamp,
    ],
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
      groupedSeriesRef.current = new Map();
      groupedSamplesRef.current = new Map();
      apiKeysRef.current = new Map();
      positionHistoryRef.current = new Map();
      executedOrdersHistoryRef.current = new Map();
      isLoadingApiKeysRef.current = false;
      setDealsState(INITIAL_DEALS_STATE);
      setPnlSeries(emptySeries);
      setGroupedPnlSeries([]);
      setApiKeysById(new Map());
      setZoomRange(undefined);
      setZoomPreset('all');
      setPositionHistory(new Map());
      setExecutedOrdersIndex({ byDeal: new Map(), all: [] });
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

  useEffect(() => {
    if (!extensionReady) {
      return;
    }
    loadApiKeys().catch(() => {
      // error logged inside loadApiKeys
    });
  }, [extensionReady, loadApiKeys]);

  useEffect(() => {
    void apiKeysById;
    syncGroupedSeries();
  }, [apiKeysById, syncGroupedSeries]);

  const resetHistory = useCallback(() => {
    const emptySeries = createEmptySeries();
    seriesRef.current = emptySeries;
    groupedSeriesRef.current = new Map();
    groupedSamplesRef.current = new Map();
    positionHistoryRef.current = new Map();
    executedOrdersHistoryRef.current = new Map();
    setPnlSeries(emptySeries);
    setGroupedPnlSeries([]);
    setDealsState(INITIAL_DEALS_STATE);
    setZoomRange(undefined);
    setZoomPreset('all');
    setPositionHistory(new Map());
    setExecutedOrdersIndex({ byDeal: new Map(), all: [] });
    initialLoadRef.current = false;
    setError(null);
    void clearActiveDealsHistoryCache();
  }, []);

  const updateRefreshInterval = useCallback((interval: ActiveDealsRefreshInterval) => {
    setRefreshIntervalState(interval);
  }, []);

  const contextValue = useMemo<ActiveDealsContextValue>(
    () => ({
      dealsState,
      pnlSeries,
      groupedPnlSeries,
      groupByApiKey,
      setGroupByApiKey: setGroupByApiKeyState,
      apiKeysById,
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
      executedOrders: executedOrdersIndex.all,
      executedOrdersByDeal: executedOrdersIndex.byDeal,
    }),
    [
      dealsState,
      pnlSeries,
      groupedPnlSeries,
      apiKeysById,
      loading,
      error,
      refreshInterval,
      groupByApiKey,
      updateRefreshInterval,
      fetchDeals,
      resetHistory,
      zoomRange,
      zoomPreset,
      positionHistory,
      executedOrdersIndex,
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
