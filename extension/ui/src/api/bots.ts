import type { BotsListParams, BotsListResponse } from '../types/bots';
import { proxyHttpRequest } from '../lib/extensionMessaging';

const BOTS_ENDPOINT = 'https://veles.finance/api/bots';

const buildQueryString = (params: BotsListParams): string => {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(Math.max(params.page, 0)));
  searchParams.set('size', String(Math.max(params.size, 1)));
  if (params.sort) {
    searchParams.set('sort', params.sort);
  }
  return searchParams.toString();
};

export const fetchBots = async (params: BotsListParams): Promise<BotsListResponse> => {
  const url = `${BOTS_ENDPOINT}?${buildQueryString(params)}`;

  const response = await proxyHttpRequest<BotsListResponse>({
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

  const { body: payload } = response;

  if (!payload) {
    throw new Error('Пустой ответ сервера.');
  }

  return payload;
};
