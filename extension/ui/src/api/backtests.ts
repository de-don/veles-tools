import type { BacktestStatisticsListResponse, BacktestsListParams } from '../types/backtests';
import { proxyHttpRequest } from '../lib/extensionMessaging';

const BACKTESTS_ENDPOINT = 'https://veles.finance/api/backtests/statistics';

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
