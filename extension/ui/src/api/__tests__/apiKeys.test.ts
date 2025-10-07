import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApiKeys } from '../apiKeys';
import type { ApiKeysListResponse } from '../../types/apiKeys';
import { proxyHttpRequest } from '../../lib/extensionMessaging';

vi.mock('../../lib/extensionMessaging', () => ({
  proxyHttpRequest: vi.fn(),
}));

const mockedProxy = vi.mocked(proxyHttpRequest);

const createResponse = (overrides: Partial<ApiKeysListResponse> = {}): ApiKeysListResponse => ({
  totalElements: 0,
  totalPages: 0,
  pageNumber: 0,
  content: [],
  ...overrides,
});

describe('fetchApiKeys', () => {
  beforeEach(() => {
    mockedProxy.mockReset();
  });

  it('requests API keys with default pagination', async () => {
    const responsePayload = createResponse({
      totalElements: 2,
      content: [
        { id: 1, name: 'Primary', exchange: 'BINANCE', accessKey: 'key', secretKey: 'sec', constraint: null },
        { id: 2, name: 'Secondary', exchange: 'BYBIT', accessKey: 'key2', secretKey: 'sec2', constraint: null },
      ],
    });
    mockedProxy.mockResolvedValue({ ok: true, body: responsePayload } as any);

    const result = await fetchApiKeys();

    expect(result).toEqual(responsePayload.content);
    expect(mockedProxy).toHaveBeenCalledTimes(1);
    const request = mockedProxy.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    expect(request?.url).toBe('https://veles.finance/api/api-keys?page=0&size=100');
    expect(request?.init?.method).toBe('GET');
    expect(request?.init?.credentials).toBe('include');
    expect(request?.init?.headers).toEqual({
      accept: 'application/json, text/plain, */*',
    });
  });

  it('throws when response body is empty', async () => {
    mockedProxy.mockResolvedValue({ ok: true, body: undefined } as any);

    await expect(fetchApiKeys()).rejects.toThrow('Пустой ответ сервера при загрузке API-ключей.');
  });

  it('throws with backend error message', async () => {
    mockedProxy.mockResolvedValue({ ok: false, error: 'Unauthorized', status: 401 } as any);

    await expect(fetchApiKeys()).rejects.toThrow('Unauthorized');
  });
});
