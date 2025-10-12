import { describe, expect, it } from 'vitest';

import type { ProxyResponsePayload } from '../extensionMessaging';
import { resolveProxyErrorMessage } from '../httpErrors';

const buildResponse = (overrides: Partial<ProxyResponsePayload<unknown>>): ProxyResponsePayload<unknown> => ({
  requestId: 'test',
  ok: false,
  ...overrides,
});

describe('resolveProxyErrorMessage', () => {
  it('prefers direct error message when available', () => {
    const response = buildResponse({ error: 'Custom error from proxy' });
    expect(resolveProxyErrorMessage(response)).toBe('Custom error from proxy');
  });

  it('combines status and string body when provided', () => {
    const response = buildResponse({
      status: 503,
      body: 'Service unavailable right now',
    });
    expect(resolveProxyErrorMessage(response)).toBe('HTTP 503: Service unavailable right now');
  });

  it('combines localized message with error code from JSON body', () => {
    const response = buildResponse({
      status: 429,
      body: {
        status: 429,
        error: 'Too Many Requests',
        message: 'Действие временно заблокировано',
      },
    });
    expect(resolveProxyErrorMessage(response)).toBe('HTTP 429: Действие временно заблокировано (Too Many Requests)');
  });

  it('falls back to status text when nothing else is available', () => {
    const response = buildResponse({
      status: 500,
      statusText: 'Internal Server Error',
    });
    expect(resolveProxyErrorMessage(response)).toBe('HTTP 500 Internal Server Error');
  });
});
