const UI_MESSAGE_SOURCE = 'veles-ui';
const CONTENT_MESSAGE_SOURCE = 'veles-content';
const BACKGROUND_MESSAGE_SOURCE = 'veles-background';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const RECONNECT_INTERVAL_MS = 1500;

const pendingRequests = new Map();
const requestQueue = [];

let requestDelayMs = 300;
let activeRequest = null;

let lastPing = 0;
let lastPingResult = { ok: false, error: 'Нет данных о соединении' };
let isConnected = true;
let reconnectTimer = null;

const ICON_SIZES = [16, 32];
const ICON_COLOR_MAP = {
  active: { r: 34, g: 197, b: 94 },
  inactive: { r: 148, g: 163, b: 184 },
};

const iconCache = new Map();
let currentIconVariant = null;

const createIconImageData = (variant, size) => {
  const cacheKey = `${variant}-${size}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  const color = ICON_COLOR_MAP[variant];
  const pixelCount = size * size;
  const buffer = new Uint8ClampedArray(pixelCount * 4);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    buffer[offset] = color.r;
    buffer[offset + 1] = color.g;
    buffer[offset + 2] = color.b;
    buffer[offset + 3] = 255;
  }

  const imageData = new ImageData(buffer, size, size);
  iconCache.set(cacheKey, imageData);
  return imageData;
};

const setActionIconVariant = (variant) => {
  if (currentIconVariant === variant) {
    return;
  }

  const imageData = {};
  ICON_SIZES.forEach((size) => {
    imageData[size] = createIconImageData(variant, size);
  });

  chrome.action.setIcon({ imageData }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.warn('[Veles background] unable to update action icon', lastError);
      return;
    }
    currentIconVariant = variant;
  });
};

const refreshActionIcon = async () => {
  let nextVariant = 'inactive';
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab?.url && activeTab.url.startsWith('https://veles.finance/')) {
      nextVariant = 'active';
    }
  } catch (error) {
    console.warn('[Veles background] failed to query active tab', error);
  }

  setActionIconVariant(nextVariant);
};

const broadcastConnectionStatus = () => {
  try {
    const response = chrome.runtime.sendMessage({
      source: BACKGROUND_MESSAGE_SOURCE,
      action: 'connection-status-update',
      payload: {
        ok: lastPingResult.ok,
        timestamp: lastPing,
        error: lastPingResult.error,
      },
    });

    if (response && typeof response.catch === 'function') {
      response.catch((error) => {
        if (error && typeof error.message === 'string' && error.message.includes('Receiving end does not exist')) {
          return;
        }
        console.warn('[Veles background] Unable to broadcast connection status (async)', error);
      });
    }
  } catch (error) {
    console.warn('[Veles background] Unable to broadcast connection status', error);
  }
};

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
};

const ensureReconnectLoop = () => {
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = setInterval(() => {
    attemptReconnect().catch((reason) => {
      console.warn('[Veles background] reconnect attempt failed:', reason);
    });
  }, RECONNECT_INTERVAL_MS);
};

const updateConnectionStatus = (ok, error) => {
  lastPing = Date.now();

  if (ok) {
    lastPingResult = { ok: true };
    isConnected = true;
    clearReconnectTimer();
    broadcastConnectionStatus();
    if (!activeRequest) {
      processQueue();
    }
    return;
  }

  lastPingResult = { ok: false, error: error ?? 'Нет соединения с вкладкой' };
  isConnected = false;
  broadcastConnectionStatus();
  ensureReconnectLoop();
};

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

const createQueueItem = (requestId, payload, sendResponse, attempts = 0) => ({
  requestId,
  payload,
  sendResponse,
  attempts,
});

const resetActiveRequest = () => {
  if (activeRequest?.timeoutId) {
    clearTimeout(activeRequest.timeoutId);
  }
  activeRequest = null;
};

const scheduleNext = () => {
  setTimeout(processQueue, requestDelayMs);
};

const failRequestImmediately = (sendResponse, requestId, message) => {
  try {
    sendResponse({ requestId, ok: false, error: message });
  } catch (error) {
    console.warn('[Veles background] unable to send failure response', error);
  }
  scheduleNext();
};

const retryActiveRequest = (message, { incrementAttempt = true } = {}) => {
  if (!activeRequest) {
    return;
  }

  const { requestId, payload, sendResponse, attempts } = activeRequest;
  pendingRequests.delete(requestId);
  resetActiveRequest();

  const nextAttempts = incrementAttempt ? attempts + 1 : attempts;
  if (incrementAttempt && nextAttempts > MAX_ATTEMPTS) {
    failRequestImmediately(sendResponse, requestId, message);
    return;
  }

  requestQueue.unshift(createQueueItem(requestId, payload, sendResponse, nextAttempts));
  if (message) {
    updateConnectionStatus(false, message);
  }
  scheduleNext();
};

const finalizeRequest = (requestId, sendResponse, payload) => {
  resetActiveRequest();

  try {
    sendResponse({ requestId, ...payload });
  } catch (error) {
    console.warn('[Veles background] unable to respond to UI', error);
  }

  scheduleNext();
};

const attemptReconnect = async () => {
  const tabId = await findActiveVelesTab();
  if (!tabId) {
    updateConnectionStatus(false, 'Не найдена вкладка veles.finance');
    return;
  }

  chrome.tabs.sendMessage(
    tabId,
    {
      source: BACKGROUND_MESSAGE_SOURCE,
      action: 'ping',
    },
    (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        updateConnectionStatus(false, lastError.message);
        return;
      }

      if (response && (response.ok || response.accepted)) {
        updateConnectionStatus(true);
      } else {
        updateConnectionStatus(false, response?.error ?? 'Нет ответа от контента');
      }
    }
  );
};

const processQueue = () => {
  if (activeRequest || requestQueue.length === 0) {
    return;
  }

  if (!isConnected) {
    return;
  }

  const queueItem = requestQueue.shift();
  if (!queueItem) {
    return;
  }

  findActiveVelesTab()
    .then((tabId) => {
      if (!tabId) {
        requestQueue.unshift(queueItem);
        updateConnectionStatus(false, 'Не найдена вкладка veles.finance');
        return;
      }

      dispatchToTab(tabId, queueItem);
    })
    .catch((error) => {
      requestQueue.unshift(queueItem);
      updateConnectionStatus(false, error instanceof Error ? error.message : String(error));
    });
};

const dispatchToTab = (tabId, queueItem) => {
  const { requestId, payload, sendResponse, attempts } = queueItem;

  activeRequest = {
    requestId,
    payload,
    sendResponse,
    attempts,
    tabId,
    timeoutId: null,
  };

  const timeoutId = setTimeout(() => {
    retryActiveRequest('Таймаут ответа от вкладки', { incrementAttempt: true });
  }, REQUEST_TIMEOUT_MS);
  activeRequest.timeoutId = timeoutId;

  pendingRequests.set(requestId, (responsePayload) => {
    clearTimeout(timeoutId);
    pendingRequests.delete(requestId);
    updateConnectionStatus(true);
    finalizeRequest(requestId, sendResponse, responsePayload);
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
        retryActiveRequest(lastError.message, { incrementAttempt: false });
        return;
      }

      if (response && response.accepted === false) {
        retryActiveRequest(response.error ?? 'Контент-скрипт отклонил запрос.', { incrementAttempt: true });
        return;
      }

      updateConnectionStatus(true);
    }
  );
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.source === UI_MESSAGE_SOURCE && message.action === 'ping') {
    findActiveVelesTab()
      .then((tabId) => {
        if (!tabId) {
          updateConnectionStatus(false, 'Не найдена вкладка veles.finance');
          sendResponse({ ok: false, error: 'Не найдена вкладка veles.finance' });
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          {
            source: BACKGROUND_MESSAGE_SOURCE,
            action: 'ping',
          },
          (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              updateConnectionStatus(false, lastError.message);
              sendResponse({ ok: false, error: lastError.message });
              return;
            }

            if (response && (response.ok || response.accepted)) {
              updateConnectionStatus(true);
              sendResponse({ ok: true });
            } else {
              const errorText = response?.error ?? 'Нет ответа от контента';
              updateConnectionStatus(false, errorText);
              sendResponse({ ok: false, error: errorText });
            }
          }
        );
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : String(error);
        updateConnectionStatus(false, messageText);
        sendResponse({ ok: false, error: messageText });
      });

    return true;
  }

  if (message.source === UI_MESSAGE_SOURCE && message.action === 'connection-status') {
    sendResponse({
      ok: lastPingResult.ok,
      timestamp: lastPing,
      error: lastPingResult.error,
    });
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
    requestQueue.push(createQueueItem(requestId, payload, sendResponse));
    processQueue();
    return true;
  }

  if (message.source === CONTENT_MESSAGE_SOURCE && message.action === 'ping-response') {
    if (message.payload?.ok) {
      updateConnectionStatus(true);
    } else {
      updateConnectionStatus(false, message.payload?.error ?? 'Неизвестная ошибка');
    }
    return false;
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

chrome.tabs.onActivated.addListener(() => {
  refreshActionIcon();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab?.active && (typeof changeInfo.url === 'string' || changeInfo.status === 'complete')) {
    refreshActionIcon();
  }
});

chrome.tabs.onRemoved.addListener(() => {
  refreshActionIcon();
});

if (chrome.windows?.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener(() => {
    refreshActionIcon();
  });
}

refreshActionIcon();

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeRequest && activeRequest.tabId === tabId) {
    retryActiveRequest('Вкладка закрыта.', { incrementAttempt: false });
  }

  findActiveVelesTab()
    .then((foundTabId) => {
      if (!foundTabId) {
        updateConnectionStatus(false, 'Нет вкладки veles.finance');
      }
    })
    .catch((error) => {
      updateConnectionStatus(false, error instanceof Error ? error.message : String(error));
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    const url = changeInfo.url ?? tab.url;
    if (url && !url.startsWith('https://veles.finance/')) {
      if (activeRequest && activeRequest.tabId === tabId) {
        retryActiveRequest('Вкладка покинула veles.finance', { incrementAttempt: false });
      }
      findActiveVelesTab()
        .then((foundTabId) => {
          if (!foundTabId) {
            updateConnectionStatus(false, 'Нет вкладки veles.finance');
          }
        })
        .catch((error) => {
          updateConnectionStatus(false, error instanceof Error ? error.message : String(error));
        });
    }
  }
});
