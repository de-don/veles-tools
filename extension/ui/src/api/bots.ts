import type { BotStatus, BotsListFilters, BotsListParams, BotsListResponse } from '../types/bots';
import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';

const BOTS_ENDPOINT = buildApiUrl('/api/bots');

interface BotsFilterRequestPayload {
  tags?: string[];
  apiKeys?: number[];
  algorithms?: string[];
  states?: BotStatus[];
}

const buildFiltersPayload = (filters?: BotsListFilters): BotsFilterRequestPayload => {
  if (!filters) {
    return {};
  }

  const payload: BotsFilterRequestPayload = {};

  const name = filters.name?.trim();
  if (name) {
    payload.tags = [name];
  }

  if (typeof filters.apiKey === 'number' && Number.isFinite(filters.apiKey)) {
    payload.apiKeys = [filters.apiKey];
  }

  if (filters.algorithms && filters.algorithms.length > 0) {
    payload.algorithms = filters.algorithms;
  }

  if (filters.statuses && filters.statuses.length > 0) {
    payload.states = filters.statuses;
  }

  return payload;
};

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
  const filtersPayload = buildFiltersPayload(params.filters);

  const response = await proxyHttpRequest<BotsListResponse>({
    url,
    init: {
      method: 'PUT',
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
      },
      body: JSON.stringify(filtersPayload),
    },
  });

  if (!response.ok) {
    const errorMessage = resolveProxyErrorMessage(response);
    throw new Error(errorMessage);
  }

  const { body: payload } = response;

  if (!payload) {
    throw new Error('Пустой ответ сервера.');
  }

  return payload;
};
