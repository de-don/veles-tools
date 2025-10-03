import type {
  BacktestCycle,
  BacktestStatisticsDetail,
  BacktestStatisticsListResponse,
  BacktestsListParams,
  PaginatedResponse,
} from '../types/backtests';
import { proxyHttpRequest } from '../lib/extensionMessaging';

const BACKTESTS_ENDPOINT = 'https://veles.finance/api/backtests/statistics';
const DEFAULT_CYCLES_PAGE_SIZE = 200;

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

export const fetchBacktestDetails = async (id: number): Promise<BacktestStatisticsDetail> => {
  const url = `${BACKTESTS_ENDPOINT}/${id}`;
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

  if (!response.body) {
    throw new Error('Пустой ответ сервера.');
  }

  return response.body;
};

export interface BacktestCyclesRequestParams {
  from?: string | null;
  to?: string | null;
  pageSize?: number;
}

export const fetchBacktestCycles = async (
  id: number,
  params: BacktestCyclesRequestParams = {},
): Promise<BacktestCycle[]> => {
  const { from, to, pageSize = DEFAULT_CYCLES_PAGE_SIZE } = params;
  const cycles: BacktestCycle[] = [];

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
    if (pageContent.length < pageSize) {
      break;
    }
  }

  return cycles;
};
