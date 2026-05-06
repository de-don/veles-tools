import {
  DEFAULT_CYCLES_PAGE_SIZE,
  fetchBacktestConfig,
  fetchBacktestCycles,
  fetchBacktestLimits,
  fetchBacktestStatistics,
  fetchBacktests,
} from '../api/backtests';
import {
  clearCachedBacktestList,
  readCachedBacktestIdSet,
  readCachedBacktestListSummary,
  readCachedBacktestCycles as storageReadCachedCycles,
  readCachedBacktestDetail as storageReadCachedDetail,
  readCachedBacktestList as storageReadCachedList,
  writeCachedBacktestCycles,
  writeCachedBacktestDetail,
  writeCachedBacktestListBatch,
} from '../storage/backtestCache';
import type {
  BacktestCycle,
  BacktestDetail,
  BacktestLimits,
  BacktestStatistics,
  BacktestStatisticsListResponse,
  BacktestsListParams,
} from '../types/backtests';
import { mapDetailFromDto, mapStatisticsListFromDto } from './backtests.mappers';

export interface GetBacktestDetailOptions {
  ignoreCache?: boolean;
  forceRefresh?: boolean;
}

export interface GetBacktestCyclesOptions {
  ignoreCache?: boolean;
  forceRefresh?: boolean;
  pageSize?: number;
}

export interface BacktestCyclesRequest extends GetBacktestCyclesOptions {
  from?: string | null;
  to?: string | null;
}

const ACCOUNT_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
let backtestLimitsCache: { value: BacktestLimits; fetchedAt: number } | null = null;
let backtestLimitsErrorCache: { error: Error; fetchedAt: number } | null = null;
let backtestLimitsRequest: Promise<BacktestLimits> | null = null;

export const getBacktestsList = async (params: BacktestsListParams): Promise<BacktestStatisticsListResponse> => {
  const dto = await fetchBacktests(params);
  return {
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
    pageNumber: dto.pageNumber,
    content: mapStatisticsListFromDto(dto.content ?? []),
  };
};

const parseBacktestLimitExpiration = (value: string | number | null): Date | null => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    const timestamp = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
};

export const getBacktestLimits = async (): Promise<BacktestLimits> => {
  const now = Date.now();
  if (backtestLimitsCache && now - backtestLimitsCache.fetchedAt < ACCOUNT_STATUS_CACHE_TTL_MS) {
    return backtestLimitsCache.value;
  }
  if (backtestLimitsErrorCache && now - backtestLimitsErrorCache.fetchedAt < ACCOUNT_STATUS_CACHE_TTL_MS) {
    throw backtestLimitsErrorCache.error;
  }
  if (backtestLimitsRequest) {
    return backtestLimitsRequest;
  }

  backtestLimitsRequest = fetchBacktestLimits()
    .then((dto) => {
      const expiration = parseBacktestLimitExpiration(dto.expiration);
      const limits: BacktestLimits = {
        permits: dto.permits,
        expiration,
        hasActiveSubscription: expiration !== null && expiration.getTime() > Date.now(),
      };

      backtestLimitsCache = { value: limits, fetchedAt: Date.now() };
      backtestLimitsErrorCache = null;
      return limits;
    })
    .catch((error) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      backtestLimitsErrorCache = { error: normalizedError, fetchedAt: Date.now() };
      throw normalizedError;
    })
    .finally(() => {
      backtestLimitsRequest = null;
    });

  return backtestLimitsRequest;
};

export const getBacktestDetail = async (
  id: number,
  options: GetBacktestDetailOptions = {},
): Promise<BacktestDetail> => {
  const { ignoreCache = false, forceRefresh = false } = options;

  if (!(ignoreCache || forceRefresh)) {
    const cached = await storageReadCachedDetail(id);
    if (cached) {
      return cached;
    }
  }

  const [statistics, config] = await Promise.all([fetchBacktestStatistics(id), fetchBacktestConfig(id)]);
  const detail = mapDetailFromDto(statistics, config);

  if (!ignoreCache) {
    await writeCachedBacktestDetail(id, detail);
  }

  return detail;
};

export const readCachedBacktestDetail = async (id: number): Promise<BacktestDetail | null> => {
  return storageReadCachedDetail(id);
};

export const readCachedBacktestList = async (): Promise<BacktestStatistics[]> => {
  return storageReadCachedList();
};

export const readCachedBacktestCycles = async (
  id: number,
  params: { from?: string | null; to?: string | null; pageSize?: number } = {},
): Promise<BacktestCycle[] | null> => {
  const pageSize = Math.max(params.pageSize ?? DEFAULT_CYCLES_PAGE_SIZE, 1);
  return storageReadCachedCycles(id, { from: params.from ?? null, to: params.to ?? null, pageSize });
};

export const getBacktestCycles = async (id: number, params: BacktestCyclesRequest = {}): Promise<BacktestCycle[]> => {
  const { ignoreCache = false, forceRefresh = false } = params;
  const from = params.from ?? null;
  const to = params.to ?? null;
  const pageSize = Math.max(params.pageSize ?? DEFAULT_CYCLES_PAGE_SIZE, 1);

  if (!(ignoreCache || forceRefresh)) {
    const cached = await storageReadCachedCycles(id, { from, to, pageSize });
    if (cached) {
      return cached;
    }
  }

  const cycles: BacktestCycle[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const response = await fetchBacktestCycles(id, {
      page,
      size: pageSize,
      sort: 'date,desc',
      from: from ?? undefined,
      to: to ?? undefined,
    });

    const content = Array.isArray(response.content) ? response.content : [];
    cycles.push(...content);

    const declaredTotalPages = Number(response.totalPages ?? totalPages);
    totalPages = Number.isFinite(declaredTotalPages) && declaredTotalPages > 0 ? declaredTotalPages : totalPages;

    page += 1;
    if (content.length === 0) {
      break;
    }
  }

  if (!ignoreCache) {
    await writeCachedBacktestCycles(id, { from, to, pageSize }, cycles);
  }

  return cycles;
};

export const backtestsService = {
  getBacktestsList,
  getBacktestLimits,
  getBacktestDetail,
  getBacktestCycles,
  readCachedBacktestDetail,
  readCachedBacktestCycles,
  readCachedBacktestList,
  readCachedBacktestListSummary,
  readCachedBacktestIdSet,
  writeCachedBacktestListBatch,
  clearCachedBacktestList,
  DEFAULT_CYCLES_PAGE_SIZE,
};

export type BacktestsService = typeof backtestsService;
export { DEFAULT_CYCLES_PAGE_SIZE } from '../api/backtests';
