import type {
  BotIdentifier,
  BotStatus,
  BotsListFilters,
  BotsListParams,
  BotsListResponse,
} from '../types/bots';
import type { BacktestConfig } from '../types/backtests';
import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';

const BOTS_ENDPOINT = buildApiUrl('/api/bots');

const DEFAULT_REQUEST_HEADERS = {
  accept: 'application/json, text/plain, */*',
};

const resolveBotId = (botId: BotIdentifier): string => {
  const parsed = String(botId).trim();
  if (!parsed) {
    throw new Error('Некорректный идентификатор бота.');
  }
  return parsed;
};

const mergeHeaders = (headers?: HeadersInit): Record<string, string> => {
  const base: Record<string, string> = { ...DEFAULT_REQUEST_HEADERS };
  if (!headers) {
    return base;
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      base[key] = value;
    });
    return base;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      base[key] = value;
    });
    return base;
  }

  return { ...base, ...(headers as Record<string, string>) };
};

export type CreateBotPayload = Omit<BacktestConfig, 'id'> & {
  id: null;
  apiKey: number;
};

export interface CreateBotResponse {
  id: number;
  name?: string | null;
  status?: string | null;
}

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
  const headers = mergeHeaders({'content-type': 'application/json'});

  const response = await proxyHttpRequest<BotsListResponse>({
    url,
    init: {
      method: 'PUT',
      credentials: 'include',
      headers,
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

const performBotAction = async (
  botId: BotIdentifier,
  init: RequestInit,
  pathSuffix: string = '',
): Promise<void> => {
  const normalizedId = resolveBotId(botId);
  const url = `${BOTS_ENDPOINT}/${normalizedId}${pathSuffix}`;
  const headers = mergeHeaders(init.headers);

  const response = await proxyHttpRequest<void>({
    url,
    init: {
      ...init,
      headers,
      credentials: 'include',
    },
  });

  if (!response.ok) {
    const errorMessage = resolveProxyErrorMessage(response);
    throw new Error(errorMessage);
  }
};

export const deleteBot = async (botId: BotIdentifier): Promise<void> => {
  await performBotAction(botId, { method: 'DELETE' });
};

export const stopBot = async (botId: BotIdentifier): Promise<void> => {
  await performBotAction(botId, { method: 'POST' }, '/stop');
};

export const startBot = async (botId: BotIdentifier): Promise<void> => {
  await performBotAction(botId, { method: 'POST' }, '/start');
};

export const createBot = async (payload: CreateBotPayload): Promise<CreateBotResponse> => {
  const headers = mergeHeaders({ 'content-type': 'application/json' });

  const response = await proxyHttpRequest<CreateBotResponse>({
    url: BOTS_ENDPOINT,
    init: {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    },
  });

  if (!response.ok) {
    const message = resolveProxyErrorMessage(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Пустой ответ сервера при создании бота.');
  }

  return response.body;
};
