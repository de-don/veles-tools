(() => {
  const PAGE_SOURCE = 'veles-bridge';
  const INJECTED_SOURCE = 'veles-injected';

  const normalizeHeaders = (headers) => {
    const result = {};
    try {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } catch (error) {
      console.warn('[Veles page bridge] Unable to normalize headers', error);
    }
    return result;
  };

  const resolveCsrfToken = () => {
    try {
      const meta = document.querySelector('meta[name="_csrf"]');
      const token = meta?.content?.trim();
      return token || null;
    } catch (error) {
      console.warn('[Veles page bridge] Unable to resolve CSRF token', error);
      return null;
    }
  };

  const ensureHeaders = (init = {}) => {
    const headers = new Headers(init.headers ?? undefined);
    if (!headers.has('x-csrf-token')) {
      const token = resolveCsrfToken();
      if (token) {
        headers.set('x-csrf-token', token);
      }
    }
    if (!headers.has('accept')) {
      headers.set('accept', 'application/json, text/plain, */*');
    }
    if (headers.size === 0) {
      return init;
    }
    const plainHeaders = {};
    headers.forEach((value, key) => {
      plainHeaders[key] = value;
    });
    return {
      ...init,
      headers: plainHeaders,
    };
  };

  const tryParseBody = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      if (contentType.startsWith('text/')) {
        return await response.text();
      }
      const blob = await response.blob();
      return { size: blob.size, type: blob.type };
    } catch (error) {
      console.warn('[Veles page bridge] Не удалось распарсить ответ', error);
      return null;
    }
  };

  const respond = (requestId, payload) => {
    window.postMessage({
      source: INJECTED_SOURCE,
      action: 'proxy-response',
      requestId,
      payload,
    });
  };

  const handleProxyRequest = async (requestId, payload) => {
    if (!payload || typeof payload.url !== 'string') {
      respond(requestId, { ok: false, error: 'Некорректный URL.' });
      return;
    }

    try {
      const init = ensureHeaders(payload.init ? { ...payload.init } : {});
      const response = await fetch(payload.url, init);
      const body = await tryParseBody(response);

      respond(requestId, {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: normalizeHeaders(response.headers),
        body,
      });
    } catch (error) {
      respond(requestId, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handlePing = () => {
    window.postMessage({
      source: INJECTED_SOURCE,
      action: 'ping-response',
      payload: { ok: true },
    });
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.source === PAGE_SOURCE && data.action === 'proxy-request') {
      handleProxyRequest(data.requestId, data.payload);
      return;
    }

    if (data.source === PAGE_SOURCE && data.action === 'ping') {
      handlePing();
    }
  });

  console.info('[Veles page bridge] инициализирован');
})();
