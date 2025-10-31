(() => {
  const BACKGROUND_SOURCE = 'veles-background';
  const CONTENT_SOURCE = 'veles-content';
  const PAGE_SOURCE = 'veles-bridge';
  const INJECTED_SOURCE = 'veles-injected';

  const pendingRequestIds = new Set();
  let injected = false;

  // Генерируем nonce для handshake
  const BRIDGE_NONCE =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const injectPageBridge = () => {
    if (injected) {
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('scripts/page-fetch-bridge.js');
      script.async = false;
      // передаём nonce инжектируемому скрипту через data атрибут
      script.dataset.velesBridgeNonce = BRIDGE_NONCE;
      script.addEventListener('load', () => {
        script.remove();
      });

      (document.head || document.documentElement).appendChild(script);
      injected = true;
    } catch (error) {
      console.error('[Veles proxy bridge] Unable to inject page bridge', error);
    }
  };

  const forwardToPage = (requestId, payload) => {
    window.postMessage(
      {
        source: PAGE_SOURCE,
        action: 'proxy-request',
        requestId,
        payload,
        nonce: BRIDGE_NONCE,
      },
      window.location.origin,
    );
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.source === INJECTED_SOURCE && data.action === 'proxy-response') {
      const { requestId, payload, nonce } = data;
      if (nonce !== BRIDGE_NONCE) {
        console.warn('[Veles proxy bridge] Ignored proxy-response with invalid nonce');
        return;
      }
      if (!pendingRequestIds.has(requestId)) {
        return;
      }

      pendingRequestIds.delete(requestId);

      chrome.runtime.sendMessage({
        source: CONTENT_SOURCE,
        action: 'proxy-response',
        requestId,
        payload,
      });
      return;
    }

    if (data.source === INJECTED_SOURCE && data.action === 'ping-response') {
      const { payload, nonce } = data;
      if (nonce !== BRIDGE_NONCE) {
        console.warn('[Veles proxy bridge] Ignored ping-response with invalid nonce');
        return;
      }
      chrome.runtime.sendMessage({
        source: CONTENT_SOURCE,
        action: 'ping-response',
        payload,
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.source === BACKGROUND_SOURCE && message.action === 'proxy-request') {
      const { requestId, payload } = message;
      if (!requestId || !payload) {
        sendResponse({
          accepted: false,
          error: 'Некорректный формат запроса.',
        });
        return false;
      }

      injectPageBridge();
      pendingRequestIds.add(requestId);
      forwardToPage(requestId, payload);

      sendResponse({ accepted: true });
      return false;
    }

    if (message.source === BACKGROUND_SOURCE && message.action === 'ping') {
      injectPageBridge();
      window.postMessage(
        {
          source: PAGE_SOURCE,
          action: 'ping',
          nonce: BRIDGE_NONCE,
        },
        window.location.origin,
      );
      sendResponse({ accepted: true });
      return false;
    }

    return false;
  });

  console.info('[Veles proxy bridge] готов');
})();
