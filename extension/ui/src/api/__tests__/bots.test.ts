import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyHttpRequest } from '../../lib/extensionMessaging';
import type { BotsListResponse } from '../../types/bots';
import { buildApiUrl } from '../baseUrl';
import { fetchBots } from '../bots';

vi.mock('../../lib/extensionMessaging', () => ({
  proxyHttpRequest: vi.fn(),
}));

const mockedProxy = vi.mocked(proxyHttpRequest);

const createResponse = (overrides: Partial<BotsListResponse> = {}): BotsListResponse => ({
  totalElements: 1,
  totalPages: 1,
  pageNumber: 0,
  content: [],
  ...overrides,
});

describe('fetchBots', () => {
  beforeEach(() => {
    mockedProxy.mockReset();
  });

  it('sends PUT request with normalized filters payload', async () => {
    const payload = createResponse();
    mockedProxy.mockResolvedValue({ ok: true, body: payload } as any);

    const result = await fetchBots({
      page: 2,
      size: 25,
      sort: 'createdAt,desc',
      filters: {
        name: '  Test Bot  ',
        apiKey: 123,
        algorithms: ['LONG'],
        statuses: ['RUNNING'],
      },
    });

    expect(result).toEqual(payload);
    expect(mockedProxy).toHaveBeenCalledTimes(1);
    const request = mockedProxy.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    const url = new URL(request?.url ?? '');
    expect(url.origin + url.pathname).toBe(buildApiUrl('/api/bots'));
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('size')).toBe('25');
    expect(url.searchParams.get('sort')).toBe('createdAt,desc');
    expect(request?.init?.method).toBe('PUT');
    expect(request?.init?.credentials).toBe('include');
    expect(request?.init?.headers).toEqual({
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
    });
    const body = request?.init?.body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(body as string)).toEqual({
      tags: ['Test Bot'],
      apiKeys: [123],
      algorithms: ['LONG'],
      states: ['RUNNING'],
    });
  });

  it('throws when response body is missing', async () => {
    mockedProxy.mockResolvedValue({ ok: true, body: undefined } as any);

    await expect(
      fetchBots({
        page: 0,
        size: 10,
      }),
    ).rejects.toThrow('Пустой ответ сервера.');
  });

  it('throws with server error message', async () => {
    mockedProxy.mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      status: 403,
    } as any);

    await expect(
      fetchBots({
        page: 0,
        size: 10,
      }),
    ).rejects.toThrow('Forbidden');
  });
});
