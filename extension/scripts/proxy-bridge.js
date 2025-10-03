(() => {
  const BACKGROUND_SOURCE = 'veles-background';
  const CONTENT_SOURCE = 'veles-content';
  const PAGE_SOURCE = 'veles-bridge';
  const INJECTED_SOURCE = 'veles-injected';

  const pendingRequestIds = new Set();
  let injected = false;

  const injectPageBridge = () => {
    if (injected) {
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('scripts/page-fetch-bridge.js');
      script.async = false;
      script.dataset.velesBridge = 'true';
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
    window.postMessage({
      source: PAGE_SOURCE,
      action: 'proxy-request',
      requestId,
      payload,
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

    if (data.source !== INJECTED_SOURCE || data.action !== 'proxy-response') {
      return;
    }

    const { requestId, payload } = data;
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
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.source !== BACKGROUND_SOURCE || message.action !== 'proxy-request') {
      return false;
    }

    const { requestId, payload } = message;
    if (!requestId || !payload) {
      sendResponse({ accepted: false, error: 'Некорректный формат запроса.' });
      return false;
    }

    injectPageBridge();
    pendingRequestIds.add(requestId);
    forwardToPage(requestId, payload);

    sendResponse({ accepted: true });
    return false;
  });

  console.info('[Veles proxy bridge] готов');
})();
