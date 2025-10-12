import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import {
  readCachedBacktestCycles,
  readCachedBacktestDetail,
  writeCachedBacktestCycles,
  writeCachedBacktestDetail,
} from '../storage/backtestCache';
import type {
  BacktestCommissionsConfig,
  BacktestCycle,
  BacktestDepositConfig,
  BacktestProfitConfig,
  BacktestSettings,
  BacktestStatisticsDetail,
  BacktestStatisticsListResponse,
  BacktestsListParams,
  PaginatedResponse,
} from '../types/backtests';
import type { StrategyCondition } from '../types/bots';
import { buildApiUrl } from './baseUrl';

const BACKTESTS_ENDPOINT = buildApiUrl('/api/backtests/statistics');
const BACKTESTS_CORE_ENDPOINT = buildApiUrl('/api/backtests');
export const DEFAULT_CYCLES_PAGE_SIZE = 200;

interface BacktestCoreResponse {
  id: number;
  name?: string | null;
  base?: string | null;
  quote?: string | null;
  symbol?: string | null;
  symbols?: string[] | null;
  exchange?: string | null;
  algorithm?: string | null;
  pullUp?: number | null;
  portion?: number | null;
  profit?: BacktestProfitConfig | null;
  deposit?: BacktestDepositConfig | null;
  settings?: BacktestSettings;
  conditions?: StrategyCondition[] | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
  commissions?: BacktestCommissionsConfig | null;
  public?: boolean | null;
  useWicks?: boolean | null;
  cursor?: string | null;
  includePosition?: boolean | null;
}

const hasDepositData = (detail: BacktestStatisticsDetail | null | undefined): boolean => {
  const deposit = detail?.deposit;
  if (!deposit) {
    return false;
  }
  return (
    (deposit.amount !== null && deposit.amount !== undefined) ||
    (deposit.leverage !== null && deposit.leverage !== undefined) ||
    (deposit.marginType !== null && deposit.marginType !== undefined)
  );
};

const needsCoreEnrichment = (detail: BacktestStatisticsDetail | null | undefined): boolean => {
  if (!detail) {
    return true;
  }
  if (!hasDepositData(detail)) {
    return true;
  }
  if (detail.settings === undefined) {
    return true;
  }
  if (detail.profit === undefined) {
    return true;
  }
  if (detail.conditions === undefined) {
    return true;
  }
  if (detail.commissions === undefined) {
    return true;
  }
  return false;
};

const extractDepositFromCore = (
  core: BacktestCoreResponse | null,
  fallbackCurrency: string | null,
): BacktestDepositConfig | null => {
  if (!core) {
    return null;
  }

  const direct = core.deposit ?? null;
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

  const symbols =
    detail.symbols && detail.symbols.length > 0
      ? detail.symbols
      : core.symbols && core.symbols.length > 0
        ? core.symbols
        : detail.symbol
          ? [detail.symbol]
          : core.symbol
            ? [core.symbol]
            : null;

  return {
    ...detail,
    name: detail.name ?? core.name ?? detail.name,
    base: detail.base ?? core.base ?? detail.base,
    quote: detail.quote ?? core.quote ?? detail.quote,
    symbol: detail.symbol ?? core.symbol ?? detail.symbol ?? (symbols ? symbols[0] : detail.symbol),
    symbols,
    exchange: detail.exchange ?? core.exchange ?? detail.exchange,
    algorithm: detail.algorithm ?? core.algorithm ?? detail.algorithm,
    pullUp: detail.pullUp ?? core.pullUp ?? null,
    portion: detail.portion ?? core.portion ?? null,
    profit: detail.profit ?? core.profit ?? null,
    deposit: deposit ?? null,
    settings: detail.settings ?? core.settings ?? detail.settings,
    conditions: detail.conditions ?? core.conditions ?? null,
    commissions: detail.commissions ?? core.commissions ?? null,
    public: detail.public ?? core.public ?? detail.public,
    useWicks: detail.useWicks ?? core.useWicks ?? detail.useWicks,
    cursor: detail.cursor ?? core.cursor ?? detail.cursor,
    includePosition: detail.includePosition ?? core.includePosition ?? detail.includePosition,
    from: detail.from ?? core.from ?? detail.from,
    to: detail.to ?? core.to ?? detail.to,
    status: detail.status ?? core.status ?? detail.status,
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
    if (cached && !needsCoreEnrichment(cached)) {
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

  if (needsCoreEnrichment(detail)) {
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
