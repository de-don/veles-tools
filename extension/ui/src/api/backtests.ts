import type {
  BacktestCycle,
  BacktestDepositConfig,
  BacktestStatisticsDetail,
  BacktestStatisticsListResponse,
  BacktestsListParams,
  PaginatedResponse,
} from '../types/backtests';
import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';
import {
  readCachedBacktestCycles,
  readCachedBacktestDetail,
  writeCachedBacktestCycles,
  writeCachedBacktestDetail,
} from '../storage/backtestCache';

const BACKTESTS_ENDPOINT = buildApiUrl('/api/backtests/statistics');
const BACKTESTS_CORE_ENDPOINT = buildApiUrl('/api/backtests');
export const DEFAULT_CYCLES_PAGE_SIZE = 200;

interface BacktestCoreSettings {
  deposit?: BacktestDepositConfig | null;
}

interface BacktestCoreResponse {
  id: number;
  base?: string | null;
  quote?: string | null;
  symbol?: string | null;
  deposit?: BacktestDepositConfig | null;
  settings?: BacktestCoreSettings | null;
}

const hasDepositData = (detail: BacktestStatisticsDetail | null | undefined): boolean => {
  const deposit = detail?.deposit;
  if (!deposit) {
    return false;
  }
  return (
    deposit.amount !== null && deposit.amount !== undefined
  ) || (
    deposit.leverage !== null && deposit.leverage !== undefined
  ) || (
    deposit.marginType !== null && deposit.marginType !== undefined
  );
};

const extractDepositFromCore = (
  core: BacktestCoreResponse | null,
  fallbackCurrency: string | null,
): BacktestDepositConfig | null => {
  if (!core) {
    return null;
  }

  const direct = core.deposit ?? core.settings?.deposit ?? null;
  if (!direct) {
    return null;
  }

  const currency =
    typeof direct.currency === 'string' && direct.currency.trim().length > 0
      ? direct.currency.trim()
      : typeof fallbackCurrency === 'string' && fallbackCurrency.trim().length > 0
        ? fallbackCurrency.trim()
        : null;

  return {
    amount: direct.amount ?? null,
    leverage: direct.leverage ?? null,
    marginType: direct.marginType ?? null,
    currency,
  };
};

const mergeBacktestDetailWithCore = (
  detail: BacktestStatisticsDetail,
  core: BacktestCoreResponse | null,
): BacktestStatisticsDetail => {
  if (!core) {
    return detail;
  }

  const deposit = hasDepositData(detail)
    ? detail.deposit
    : extractDepositFromCore(core, detail.quote ?? core.quote ?? null);

  return {
    ...detail,
    base: detail.base ?? core.base ?? detail.base,
    quote: detail.quote ?? core.quote ?? detail.quote,
    symbol: detail.symbol ?? core.symbol ?? detail.symbol,
    deposit: deposit ?? null,
  };
};

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
    const errorMessage = resolveProxyErrorMessage(response);
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

const fetchBacktestCore = async (id: number): Promise<BacktestCoreResponse | null> => {
  const response = await proxyHttpRequest<BacktestCoreResponse>({
    url: `${BACKTESTS_CORE_ENDPOINT}/${id}`,
    init: {
      method: 'GET',
      credentials: 'include',
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.body ?? null;
};

export const fetchBacktestDetails = async (
  id: number,
  options: FetchBacktestDetailsOptions = {},
): Promise<BacktestStatisticsDetail> => {
  const url = `${BACKTESTS_ENDPOINT}/${id}`;

  const { ignoreCache = false, forceRefresh = false } = options;
  if (!ignoreCache && !forceRefresh) {
    const cached = await readCachedBacktestDetail(id);
    if (cached && hasDepositData(cached)) {
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
    const errorMessage = resolveProxyErrorMessage(response);
    throw new Error(errorMessage);
  }

  const { body } = response;
  if (!body) {
    throw new Error('Пустой ответ сервера.');
  }

  let detail: BacktestStatisticsDetail = body;

  if (!hasDepositData(detail)) {
    try {
      const core = await fetchBacktestCore(id);
      detail = mergeBacktestDetailWithCore(detail, core);
    } catch (coreError) {
      console.warn(`[Backtests] Failed to load core details for backtest ${id}`, coreError);
    }
  }

  if (!ignoreCache) {
    await writeCachedBacktestDetail(id, detail);
  }

  return detail;
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
      const errorMessage = resolveProxyErrorMessage(response);
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
