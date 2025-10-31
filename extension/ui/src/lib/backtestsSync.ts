import { fetchBacktests } from '../api/backtests';
import {
  clearCachedBacktestList,
  readCachedBacktestIdSet,
  writeCachedBacktestListBatch,
} from '../storage/backtestCache';
import type { BacktestStatistics } from '../types/backtests';

const DEFAULT_SYNC_PAGE_SIZE = 200;
const DEFAULT_SORT = 'date,desc';

export type BacktestsSyncStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

export interface BacktestsSyncSnapshot {
  status: BacktestsSyncStatus;
  processed: number;
  stored: number;
  fetchedPages: number;
  totalRemote: number | null;
  error?: string;
}

export interface BacktestsSyncOptions {
  clearBeforeSync?: boolean;
  signal?: AbortSignal | null;
  pageSize?: number;
  sort?: string;
  onProgress?: (snapshot: BacktestsSyncSnapshot) => void;
}

class BacktestsSyncAbortError extends Error {
  constructor(message = 'Backtest sync aborted') {
    super(message);
    this.name = 'BacktestsSyncAbortError';
  }
}

const ensureNotAborted = (signal?: AbortSignal | null): void => {
  if (signal?.aborted) {
    throw new BacktestsSyncAbortError(
      typeof signal.reason === 'string' && signal.reason.length > 0 ? signal.reason : 'Backtest sync aborted by user',
    );
  }
};

const emitProgress = (callback: BacktestsSyncOptions['onProgress'], snapshot: BacktestsSyncSnapshot): void => {
  if (typeof callback === 'function') {
    callback(snapshot);
  }
};

export const performBacktestsSync = async (options: BacktestsSyncOptions = {}): Promise<BacktestsSyncSnapshot> => {
  const pageSize = options.pageSize && options.pageSize > 0 ? Math.floor(options.pageSize) : DEFAULT_SYNC_PAGE_SIZE;
  const sort = options.sort ?? DEFAULT_SORT;
  const signal = options.signal ?? null;

  try {
    ensureNotAborted(signal);
  } catch (error) {
    if (error instanceof BacktestsSyncAbortError) {
      const snapshot: BacktestsSyncSnapshot = {
        status: 'cancelled',
        processed: 0,
        stored: 0,
        fetchedPages: 0,
        totalRemote: null,
      };
      emitProgress(options.onProgress, snapshot);
      return snapshot;
    }
    throw error;
  }

  if (options.clearBeforeSync) {
    await clearCachedBacktestList();
  }

  const knownIds = await readCachedBacktestIdSet();
  let processed = 0;
  let stored = 0;
  let page = 0;
  let fetchedPages = 0;
  let remoteTotal: number | null = null;

  emitProgress(options.onProgress, {
    status: 'running',
    processed,
    stored,
    fetchedPages,
    totalRemote: remoteTotal,
  });

  try {
    for (;;) {
      ensureNotAborted(signal);

      const response = await fetchBacktests({ page, size: pageSize, sort });
      fetchedPages += 1;
      if (typeof response.totalElements === 'number') {
        remoteTotal = response.totalElements;
      }
      const totalPages = typeof response.totalPages === 'number' ? response.totalPages : null;

      const items = response.content ?? [];
      if (items.length === 0) {
        break;
      }

      const freshBatch: BacktestStatistics[] = [];

      for (const snapshot of items) {
        processed += 1;
        if (knownIds.has(snapshot.id)) {
          continue;
        }
        freshBatch.push(snapshot);
      }

      if (freshBatch.length > 0) {
        await writeCachedBacktestListBatch(freshBatch);
        freshBatch.forEach((snapshot) => {
          knownIds.add(snapshot.id);
        });
        stored += freshBatch.length;
      }

      emitProgress(options.onProgress, {
        status: 'running',
        processed,
        stored,
        fetchedPages,
        totalRemote: remoteTotal,
      });

      if (remoteTotal !== null && knownIds.size >= remoteTotal) {
        break;
      }

      if (totalPages !== null && page >= totalPages - 1) {
        break;
      }

      page += 1;
    }
  } catch (error) {
    if (error instanceof BacktestsSyncAbortError) {
      return {
        status: 'cancelled',
        processed,
        stored,
        fetchedPages,
        totalRemote: remoteTotal,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    emitProgress(options.onProgress, {
      status: 'error',
      processed,
      stored,
      fetchedPages,
      totalRemote: remoteTotal,
      error: message,
    });

    return {
      status: 'error',
      processed,
      stored,
      fetchedPages,
      totalRemote: remoteTotal,
      error: message,
    };
  }

  const finalSnapshot: BacktestsSyncSnapshot = {
    status: 'success',
    processed,
    stored,
    fetchedPages,
    totalRemote: remoteTotal,
  };

  emitProgress(options.onProgress, finalSnapshot);
  return finalSnapshot;
};
