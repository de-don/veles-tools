const UI_MESSAGE_SOURCE = 'veles-ui';
const CONTENT_MESSAGE_SOURCE = 'veles-content';
const BACKGROUND_MESSAGE_SOURCE = 'veles-background';

const pendingRequests = new Map();

const generateRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const findActiveVelesTab = async () => {
  const candidates = await chrome.tabs.query({ url: 'https://veles.finance/*' });
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const activeTab = candidates.find((tab) => tab.active) ?? candidates[0];
  return activeTab?.id ?? null;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.source === UI_MESSAGE_SOURCE && message.action === 'proxy-request') {
    const payload = message.payload;
    if (!payload || typeof payload.url !== 'string') {
      sendResponse({ ok: false, error: 'Некорректный payload запроса.' });
      return false;
    }

    const requestId = generateRequestId();

    findActiveVelesTab()
      .then((tabId) => {
        if (!tabId) {
          sendResponse({ ok: false, error: 'Не найдена открытая вкладка veles.finance.' });
          return;
        }

        const dispatchRequest = (attempt = 1) => {
          pendingRequests.set(requestId, sendResponse);

          chrome.tabs.sendMessage(tabId, {
            source: BACKGROUND_MESSAGE_SOURCE,
            action: 'proxy-request',
            requestId,
            payload,
          }, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              pendingRequests.delete(requestId);

              if (
                attempt === 1 &&
                typeof chrome.scripting !== 'undefined' &&
                lastError.message?.includes('Receiving end does not exist')
              ) {
                chrome.scripting.executeScript(
                  {
                    target: { tabId },
                    files: ['scripts/proxy-bridge.js'],
                  },
                  () => {
                    const injectionError = chrome.runtime.lastError;
                    if (injectionError) {
                      sendResponse({ ok: false, error: injectionError.message });
                      return;
                    }

                    dispatchRequest(attempt + 1);
                  }
                );
                return;
              }

              sendResponse({ ok: false, error: lastError.message });
              return;
            }

            if (response && response.accepted === false) {
              pendingRequests.delete(requestId);
              sendResponse({ ok: false, error: response.error ?? 'Контент-скрипт отклонил запрос.' });
            }
          });
        };

        dispatchRequest();
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });

    return true;
  }

  if (message.source === CONTENT_MESSAGE_SOURCE && message.action === 'proxy-response') {
    const { requestId, payload } = message;
    const responder = pendingRequests.get(requestId);

    if (responder) {
      responder({ requestId, ...payload });
      pendingRequests.delete(requestId);
    }

    return false;
  }

  return false;
});
