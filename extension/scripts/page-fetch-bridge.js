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
      const init = payload.init ? { ...payload.init } : {};
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

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.source !== PAGE_SOURCE || data.action !== 'proxy-request') {
      return;
    }

    handleProxyRequest(data.requestId, data.payload);
  });

  console.info('[Veles page bridge] инициализирован');
})();
