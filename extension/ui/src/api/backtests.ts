import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import type { BacktestsListParams } from '../types/backtests';
import type {
  BacktestConfigDto,
  BacktestCyclesListDto,
  BacktestStatisticsDto,
  BacktestStatisticsListDto,
} from './backtests.dtos';
import { buildApiUrl } from './baseUrl';

const BACKTESTS_ENDPOINT = buildApiUrl('/api/backtests/statistics');
const BACKTESTS_CORE_ENDPOINT = buildApiUrl('/api/backtests');
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

export const fetchBacktests = async (params: BacktestsListParams): Promise<BacktestStatisticsListDto> => {
  const url = `${BACKTESTS_ENDPOINT}?${buildQueryString(params)}`;

  const response = await proxyHttpRequest<BacktestStatisticsListDto>({
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

export const fetchBacktestStatistics = async (id: number): Promise<BacktestStatisticsDto> => {
  const url = `${BACKTESTS_ENDPOINT}/${id}`;

  const response = await proxyHttpRequest<BacktestStatisticsDto>({
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

export const fetchBacktestConfig = async (id: number): Promise<BacktestConfigDto> => {
  const response = await proxyHttpRequest<BacktestConfigDto>({
    url: `${BACKTESTS_CORE_ENDPOINT}/${id}`,
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

export interface BacktestCyclesRequestParams {
  from?: string | null;
  to?: string | null;
  size?: number;
  page?: number;
  sort?: string;
}

export const fetchBacktestCycles = async (
  id: number,
  params: BacktestCyclesRequestParams = {},
): Promise<BacktestCyclesListDto> => {
  const searchParams = new URLSearchParams();
  const page = params.page ?? 0;
  const size = Math.max(params.size ?? DEFAULT_CYCLES_PAGE_SIZE, 1);

  searchParams.set('page', String(Math.max(page, 0)));
  searchParams.set('size', String(size));
  searchParams.set('sort', params.sort ?? 'date,desc');

  if (params.from) {
    searchParams.set('from', params.from);
  }
  if (params.to) {
    searchParams.set('to', params.to);
  }

  const url = `${BACKTESTS_ENDPOINT}/${id}/cycles?${searchParams.toString()}`;
  const response = await proxyHttpRequest<BacktestCyclesListDto>({
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

  return body;
};
