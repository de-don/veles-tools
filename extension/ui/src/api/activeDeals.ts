import type { ActiveDeal, ActiveDealsQueryParams, ActiveDealsResponse } from '../types/activeDeals';
import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';

const ACTIVE_DEALS_ENDPOINT = buildApiUrl('/api/cycles/active');

const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 100;

const buildQueryString = (params?: ActiveDealsQueryParams): string => {
  const query = new URLSearchParams();
  const page = params?.page ?? DEFAULT_PAGE;
  const size = params?.size ?? DEFAULT_SIZE;
  query.set('page', String(Math.max(0, page)));
  query.set('size', String(Math.max(1, size)));
  if (params?.exchange) {
    query.set('exchange', params.exchange);
  }
  return query.toString();
};

export const fetchActiveDeals = async (
  params?: ActiveDealsQueryParams,
): Promise<ActiveDealsResponse> => {
  const url = `${ACTIVE_DEALS_ENDPOINT}?${buildQueryString(params)}`;

  const response = await proxyHttpRequest<ActiveDealsResponse>({
    url,
    init: {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    },
  });

  if (!response.ok) {
    const errorMessage = resolveProxyErrorMessage(response);
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Пустой ответ сервера.');
  }

  return response.body;
};

export const ACTIVE_DEALS_DEFAULT_SIZE = DEFAULT_SIZE;

interface FetchAllParams extends Omit<ActiveDealsQueryParams, 'page'> {
  page?: never;
}

export const fetchAllActiveDeals = async (params?: FetchAllParams): Promise<ActiveDeal[]> => {
  const size = params?.size ?? DEFAULT_SIZE;
  let page = 0;
  let totalPages = 1;
  const collected: ActiveDeal[] = [];

  while (page < totalPages) {
    const response = await fetchActiveDeals({ ...params, page, size });
    collected.push(...response.content);
    totalPages = Math.max(response.totalPages ?? totalPages, page + 1);
    if (response.content.length === 0) {
      break;
    }
    page += 1;
  }

  return collected;
};
