import type {
  BacktestCycle,
  BacktestStatisticsDetail,
  BacktestStatisticsListResponse,
  BacktestsListParams,
  PaginatedResponse,
} from '../types/backtests';
import { proxyHttpRequest } from '../lib/extensionMessaging';
import {
  readCachedBacktestCycles,
  readCachedBacktestDetail,
  writeCachedBacktestCycles,
  writeCachedBacktestDetail,
} from '../storage/backtestCache';

const BACKTESTS_ENDPOINT = 'https://veles.finance/api/backtests/statistics';
export const DEFAULT_CYCLES_PAGE_SIZE = 200;

const buildQueryString = (params: BacktestsListParams): string => {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(Math.max(params.page, 0)));
  searchParams.set('size', String(Math.max(params.size, 1)));
  if (params.sort) {
    searchParams.set('sort', params.sort);
  }
  return searchParams.toString();
};

export const fetchBacktests = async (params: BacktestsListParams): Promise<BacktestStatisticsListResponse> => {
  const url = `${BACKTESTS_ENDPOINT}?${buildQueryString(params)}`;

  const response = await proxyHttpRequest<BacktestStatisticsListResponse>({
    url,
    init: {
      method: 'GET',
      credentials: 'include',
    },
  });

  if (!response.ok) {
    const errorMessage = response.error ?? `HTTP ${response.status ?? 0}`;
    throw new Error(errorMessage);
  }

  const { body } = response;
  if (!body) {
    throw new Error('Пустой ответ сервера.');
  }

  return body;
};

export interface FetchBacktestDetailsOptions {
  /**
   * Пропустить чтение и запись в кэш. Полезно при ручном обновлении данных.
   */
  ignoreCache?: boolean;
  /**
   * Пропустить чтение кэша, но обновить его полученными данными.
   */
  forceRefresh?: boolean;
}

export const fetchBacktestDetails = async (
  id: number,
  options: FetchBacktestDetailsOptions = {},
): Promise<BacktestStatisticsDetail> => {
  const url = `${BACKTESTS_ENDPOINT}/${id}`;

  const { ignoreCache = false, forceRefresh = false } = options;
  if (!ignoreCache && !forceRefresh) {
    const cached = await readCachedBacktestDetail(id);
    if (cached) {
      return cached;
    }
  }

  const response = await proxyHttpRequest<BacktestStatisticsDetail>({
    url,
    init: {
      method: 'GET',
      credentials: 'include',
    },
  });

  if (!response.ok) {
    const errorMessage = response.error ?? `HTTP ${response.status ?? 0}`;
    throw new Error(errorMessage);
  }

  const { body } = response;
  if (!body) {
    throw new Error('Пустой ответ сервера.');
  }

  if (!ignoreCache) {
    await writeCachedBacktestDetail(id, body);
  }

  return body;
};

export interface BacktestCyclesRequestParams {
  from?: string | null;
  to?: string | null;
  pageSize?: number;
}

export interface FetchBacktestCyclesOptions {
  /**
   * Пропустить чтение и запись в кэш.
   */
  ignoreCache?: boolean;
  /**
   * Пропустить чтение кэша, но сохранить актуальные данные.
   */
  forceRefresh?: boolean;
}

export const fetchBacktestCycles = async (
  id: number,
  params: BacktestCyclesRequestParams = {},
  options: FetchBacktestCyclesOptions = {},
): Promise<BacktestCycle[]> => {
  const { ignoreCache = false, forceRefresh = false } = options;
  const from = params.from ?? null;
  const to = params.to ?? null;
  const pageSize = Math.max(params.pageSize ?? DEFAULT_CYCLES_PAGE_SIZE, 1);
  const cycles: BacktestCycle[] = [];

  if (!ignoreCache && !forceRefresh) {
    const cached = await readCachedBacktestCycles(id, { from, to, pageSize });
    if (cached) {
      return cached;
    }
  }

  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('size', String(Math.max(pageSize, 1)));
    searchParams.set('sort', 'date,desc');
    if (from) {
      searchParams.set('from', from);
    }
    if (to) {
      searchParams.set('to', to);
    }

    const url = `${BACKTESTS_ENDPOINT}/${id}/cycles?${searchParams.toString()}`;
    const response = await proxyHttpRequest<PaginatedResponse<BacktestCycle>>({
      url,
      init: {
        method: 'GET',
        credentials: 'include',
      },
    });

    if (!response.ok) {
      const errorMessage = response.error ?? `HTTP ${response.status ?? 0}`;
      throw new Error(errorMessage);
    }

    const body = response.body;
    if (!body) {
      throw new Error('Пустой ответ сервера.');
    }

    const pageContent = Array.isArray(body.content) ? body.content : [];
    cycles.push(...pageContent);

    const declaredTotalPages = Number(body.totalPages ?? totalPages);
    totalPages = Number.isFinite(declaredTotalPages) && declaredTotalPages > 0 ? declaredTotalPages : totalPages;

    page += 1;
    if (pageContent.length === 0) {
      break;
    }
  }

  if (!ignoreCache) {
    await writeCachedBacktestCycles(id, { from, to, pageSize }, cycles);
  }

  return cycles;
};
