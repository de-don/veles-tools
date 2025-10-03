const UI_MESSAGE_SOURCE = 'veles-ui';
const CONTENT_MESSAGE_SOURCE = 'veles-content';
const BACKGROUND_MESSAGE_SOURCE = 'veles-background';

const pendingRequests = new Map();
let requestDelayMs = 300;
let requestQueue = [];
let activeRequest = null;

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

const processQueue = () => {
  if (activeRequest || requestQueue.length === 0) {
    return;
  }

  const nextItem = requestQueue.shift();
  if (!nextItem) {
    return;
  }

  const { tabId, requestId, payload, sendResponse } = nextItem;

  const finalize = (resultPayload) => {
    try {
      sendResponse({ requestId, ...resultPayload });
    } catch (error) {
      console.warn('[Veles background] Unable to send response to UI', error);
    } finally {
      activeRequest = null;
      setTimeout(processQueue, requestDelayMs);
    }
  };

  activeRequest = { ...nextItem, finalize };

  const dispatchToTab = (attempt = 1) => {
    pendingRequests.set(requestId, (responsePayload) => {
      pendingRequests.delete(requestId);
      finalize(responsePayload);
    });

    chrome.tabs.sendMessage(
      tabId,
      {
        source: BACKGROUND_MESSAGE_SOURCE,
        action: 'proxy-request',
        requestId,
        payload,
      },
      (response) => {
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
                  finalize({ ok: false, error: injectionError.message });
                  return;
                }

                dispatchToTab(attempt + 1);
              }
            );
            return;
          }

          finalize({ ok: false, error: lastError.message });
          return;
        }

        if (response && response.accepted === false) {
          pendingRequests.delete(requestId);
          finalize({ ok: false, error: response.error ?? 'Контент-скрипт отклонил запрос.' });
        }
      }
    );
  };

  dispatchToTab();
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.source === UI_MESSAGE_SOURCE && message.action === 'update-delay') {
    const delayCandidate = Number(message.payload?.delayMs);
    if (!Number.isFinite(delayCandidate) || delayCandidate < 0) {
      sendResponse({ ok: false, error: 'Некорректное значение задержки.' });
      return false;
    }

    requestDelayMs = delayCandidate;
    sendResponse({ ok: true, delayMs: requestDelayMs });
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

        requestQueue.push({ tabId, requestId, payload, sendResponse });
        processQueue();
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
      responder(payload);
    }

    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  requestQueue = requestQueue.filter((item) => item.tabId !== tabId);

  if (activeRequest && activeRequest.tabId === tabId) {
    const { requestId, finalize } = activeRequest;
    pendingRequests.delete(requestId);
    activeRequest = null;
    finalize({ ok: false, error: 'Вкладка закрыта.' });
  }
});
