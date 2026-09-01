import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type BacktestsSyncSnapshot, performBacktestsSync } from '../lib/backtestsSync';
import { backtestsService } from '../services/backtests';
import { readCachedBacktestList, subscribeBacktestList } from '../storage/backtestCache';
import type { BacktestStatistics } from '../types/backtests';

interface RemoteSnapshotState {
  total: number | null;
  /** Id of the newest backtest on the server — the reliable "is the cache behind?" signal. */
  newestId: number | null;
  loading: boolean;
  error: string | null;
  lastChecked: number | null;
}

interface BacktestsSyncContextValue {
  backtests: BacktestStatistics[];
  backtestsLoading: boolean;
  localCount: number;
  oldestLocalDate: string | null;
  syncSnapshot: BacktestsSyncSnapshot | null;
  isSyncRunning: boolean;
  startSync: (options?: { clearBefore?: boolean }) => Promise<BacktestsSyncSnapshot | null>;
  stopSync: () => void;
  refreshRemoteTotal: () => Promise<void>;
  remoteTotal: number | null;
  remoteLoading: boolean;
  remoteError: string | null;
  lastRemoteCheck: number | null;
  lastSyncCompletedAt: number | null;
  autoSyncPending: boolean;
}

const BacktestsSyncContext = createContext<BacktestsSyncContextValue | undefined>(undefined);

interface BacktestsSyncProviderProps {
  extensionReady: boolean;
}

const resolveOldestDate = (snapshots: BacktestStatistics[]): string | null => {
  if (snapshots.length === 0) {
    return null;
  }
  const candidate = snapshots[snapshots.length - 1];
  const order = [candidate.to, candidate.date, candidate.from];
  for (const value of order) {
    if (value) {
      return value;
    }
  }
  return null;
};

export const BacktestsSyncProvider = ({ extensionReady, children }: PropsWithChildren<BacktestsSyncProviderProps>) => {
  const [listState, setListState] = useState<{ items: BacktestStatistics[]; loading: boolean }>(() => ({
    items: [],
    loading: true,
  }));

  useEffect(() => {
    let cancelled = false;
    // A sync writes one batch per page and every write notifies. Reading the whole list back for
    // each of them re-rendered the table on every page, so the reads are coalesced: while one is
    // in flight the notifications collapse into a single trailing re-read.
    let reading = false;
    let rereadPending = false;

    const hydrate = async (): Promise<void> => {
      if (reading) {
        rereadPending = true;
        return;
      }

      reading = true;
      try {
        do {
          rereadPending = false;
          const items = await readCachedBacktestList();
          if (cancelled) {
            return;
          }
          setListState({ items, loading: false });
        } while (rereadPending);
      } finally {
        reading = false;
      }
    };

    hydrate().catch((error) => {
      console.warn('[BacktestsSync] Не удалось загрузить локальный список бэктестов', error);
      setListState({ items: [], loading: false });
    });

    const unsubscribe = subscribeBacktestList(() => {
      hydrate().catch((error) => {
        console.warn('[BacktestsSync] Не удалось обновить локальный список бэктестов', error);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [remoteState, setRemoteState] = useState<RemoteSnapshotState>({
    total: null,
    newestId: null,
    loading: false,
    error: null,
    lastChecked: null,
  });
  const lastAutoSyncAttemptRef = useRef<string | null>(null);
  const [lastSyncCompletedAt, setLastSyncCompletedAt] = useState<number | null>(null);
  const [autoSyncPending, setAutoSyncPending] = useState(false);

  const refreshRemoteTotal = useCallback(async () => {
    if (!extensionReady) {
      setRemoteState((prev) => ({
        ...prev,
        loading: false,
        error: 'Расширение недоступно для синхронизации',
      }));
      return;
    }

    setRemoteState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await backtestsService.getBacktestsList({ page: 0, size: 1, sort: 'date,desc' });
      const total = typeof response.totalElements === 'number' ? response.totalElements : response.content.length;
      // An explicit refresh is also a request to retry an auto-sync that previously made no progress.
      lastAutoSyncAttemptRef.current = null;
      setRemoteState({
        total,
        newestId: response.content[0]?.id ?? null,
        loading: false,
        error: null,
        lastChecked: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRemoteState({
        total: null,
        newestId: null,
        loading: false,
        error: message,
        lastChecked: Date.now(),
      });
    }
  }, [extensionReady]);

  useEffect(() => {
    if (!extensionReady) {
      return;
    }
    refreshRemoteTotal().catch((error) => {
      console.warn('[BacktestsSync] Не удалось обновить состояние сервера', error);
    });
  }, [extensionReady, refreshRemoteTotal]);

  const [syncSnapshot, setSyncSnapshot] = useState<BacktestsSyncSnapshot | null>(null);
  const syncControllerRef = useRef<AbortController | null>(null);
  const autoSyncInFlightRef = useRef(false);
  const extensionReadyRef = useRef(extensionReady);

  useEffect(() => {
    extensionReadyRef.current = extensionReady;
  }, [extensionReady]);

  useEffect(() => {
    return () => {
      const controller = syncControllerRef.current;
      if (controller) {
        controller.abort('Component unmounted');
      }
    };
  }, []);

  // Kept in refs so that startSync has a stable identity: it is a dependency of the auto-sync
  // effect below, and a callback rebuilt on every progress update would retrigger that effect.
  const remoteTotalRef = useRef<number | null>(null);
  const syncSnapshotRef = useRef<BacktestsSyncSnapshot | null>(null);

  useEffect(() => {
    remoteTotalRef.current = remoteState.total;
  }, [remoteState.total]);

  useEffect(() => {
    syncSnapshotRef.current = syncSnapshot;
  }, [syncSnapshot]);

  const startSync = useCallback(async ({ clearBefore = false }: { clearBefore?: boolean } = {}) => {
    if (syncControllerRef.current) {
      return null;
    }

    const controller = new AbortController();
    syncControllerRef.current = controller;
    let active = true;

    const initialTotal = remoteTotalRef.current ?? syncSnapshotRef.current?.totalRemote ?? null;

    setSyncSnapshot({
      status: 'running',
      processed: 0,
      stored: 0,
      fetchedPages: 0,
      totalRemote: initialTotal,
    });

    setRemoteState((prev) => ({ ...prev, loading: true, error: null }));

    const handleProgress = (snapshot: BacktestsSyncSnapshot) => {
      if (!active) {
        return;
      }
      setSyncSnapshot(snapshot);
      if (snapshot.totalRemote !== null) {
        setRemoteState((prev) => ({
          ...prev,
          total: snapshot.totalRemote ?? prev.total,
          loading: false,
          error: null,
          lastChecked: Date.now(),
        }));
      }
    };

    const result = await performBacktestsSync({
      clearBeforeSync: clearBefore,
      signal: controller.signal,
      onProgress: handleProgress,
    });

    if (active) {
      setSyncSnapshot(result);
      setRemoteState((prev) => ({
        ...prev,
        total: result.totalRemote ?? prev.total,
        loading: false,
        error: result.status === 'error' ? (result.error ?? prev.error) : prev.error,
        lastChecked: Date.now(),
      }));
      if (result.status === 'success') {
        setLastSyncCompletedAt(Date.now());
      }
    }

    if (syncControllerRef.current === controller) {
      syncControllerRef.current = null;
    }
    active = false;

    return result;
  }, []);

  const stopSync = useCallback(() => {
    const controller = syncControllerRef.current;
    if (controller) {
      controller.abort('Sync cancelled by user');
    }
  }, []);

  const backtests = listState.items;
  const backtestsLoading = listState.loading;
  const localCount = backtests.length;
  const localIds = useMemo(() => new Set(backtests.map((item) => item.id)), [backtests]);
  const oldestLocalDate = useMemo(() => resolveOldestDate(backtests), [backtests]);
  const isSyncRunning = syncSnapshot?.status === 'running';
  useEffect(() => {
    if (!extensionReady || isSyncRunning || autoSyncInFlightRef.current) {
      return;
    }

    const remote = remoteState.total;
    if (remote === null) {
      return;
    }

    const newestId = remoteState.newestId;
    const isBehind = newestId !== null ? !localIds.has(newestId) : localCount < remote;
    if (!isBehind) {
      return;
    }

    // A sync can legitimately end with fewer local records than the server reports: it may count
    // backtests the list no longer returns, and a deal finishing mid-sync shifts the pages under
    // us. Without this guard the counts would never converge and the effect would restart the
    // sync forever, which is what made the page flicker between the list and the sync placeholder.
    const attempt = `${remote}:${localCount}`;
    if (lastAutoSyncAttemptRef.current === attempt) {
      return;
    }
    lastAutoSyncAttemptRef.current = attempt;

    autoSyncInFlightRef.current = true;
    setAutoSyncPending(true);

    const runAutoSync = async () => {
      try {
        await startSync();
      } catch (error) {
        console.warn('[BacktestsSync] Автосинхронизация завершилась с ошибкой', error);
      } finally {
        autoSyncInFlightRef.current = false;
        setAutoSyncPending(false);
      }
    };

    runAutoSync().catch((error) => {
      console.warn('[BacktestsSync] Ошибка автосинхронизации', error);
      autoSyncInFlightRef.current = false;
      setAutoSyncPending(false);
    });
  }, [extensionReady, isSyncRunning, remoteState.total, remoteState.newestId, localIds, localCount, startSync]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!isSyncRunning) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const message = 'Синхронизация бэктестов всё ещё выполняется. Вы уверены, что хотите закрыть вкладку?';
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSyncRunning]);

  const contextValue = useMemo<BacktestsSyncContextValue>(
    () => ({
      backtests,
      backtestsLoading,
      localCount,
      oldestLocalDate,
      syncSnapshot,
      isSyncRunning,
      startSync,
      stopSync,
      refreshRemoteTotal,
      remoteTotal: remoteState.total,
      remoteLoading: remoteState.loading,
      remoteError: remoteState.error,
      lastRemoteCheck: remoteState.lastChecked,
      lastSyncCompletedAt,
      autoSyncPending,
    }),
    [
      backtests,
      backtestsLoading,
      localCount,
      oldestLocalDate,
      syncSnapshot,
      isSyncRunning,
      startSync,
      stopSync,
      refreshRemoteTotal,
      remoteState.total,
      remoteState.loading,
      remoteState.error,
      remoteState.lastChecked,
      lastSyncCompletedAt,
      autoSyncPending,
    ],
  );

  return <BacktestsSyncContext.Provider value={contextValue}>{children}</BacktestsSyncContext.Provider>;
};

export const useBacktestsSync = (): BacktestsSyncContextValue => {
  const context = useContext(BacktestsSyncContext);
  if (!context) {
    throw new Error('useBacktestsSync требуется использовать внутри BacktestsSyncProvider');
  }
  return context;
};
