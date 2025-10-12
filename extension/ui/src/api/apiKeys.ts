import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import type { ApiKey, ApiKeysListParams, ApiKeysListResponse } from '../types/apiKeys';
import { buildApiUrl } from './baseUrl';

const API_KEYS_ENDPOINT = buildApiUrl('/api/api-keys');

const buildQueryString = (params?: ApiKeysListParams): string => {
  const searchParams = new URLSearchParams();
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  searchParams.set('page', String(Math.max(page, 0)));
  searchParams.set('size', String(Math.max(size, 1)));
  return searchParams.toString();
};

export const fetchApiKeys = async (params?: ApiKeysListParams): Promise<ApiKey[]> => {
  const query = buildQueryString(params);
  const response = await proxyHttpRequest<ApiKeysListResponse>({
    url: `${API_KEYS_ENDPOINT}?${query}`,
    init: {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    },
  });

  if (!response.ok) {
    const message = resolveProxyErrorMessage(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Пустой ответ сервера при загрузке API-ключей.');
  }

  return response.body.content;
};
