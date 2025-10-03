export interface RuntimeMessage<TPayload = unknown> {
  source: string;
  action: string;
  payload?: TPayload;
}

export interface ProxyRequestPayload {
  url: string;
  init?: RequestInit;
}

export interface ProxyResponsePayload<TBody = unknown> {
  requestId: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  body?: TBody;
  error?: string;
  headers?: Record<string, string>;
}

export const isExtensionRuntime = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && Boolean(chrome.runtime.id);
};

export const sendRuntimeMessage = async <TResponse = unknown, TPayload = unknown>(
  message: RuntimeMessage<TPayload>,
): Promise<TResponse> => {
  if (!isExtensionRuntime()) {
    throw new Error('Расширение не доступно. Запустите UI как часть расширения.');
  }

  return new Promise<TResponse>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response as TResponse);
    });
  });
};

export const proxyHttpRequest = async <TBody = unknown>(
  payload: ProxyRequestPayload,
): Promise<ProxyResponsePayload<TBody>> => {
  const response = await sendRuntimeMessage<ProxyResponsePayload<TBody>>({
    source: 'veles-ui',
    action: 'proxy-request',
    payload,
  });

  return response;
};

export const updateRequestDelay = async (delayMs: number): Promise<{ ok: boolean; delayMs: number }> => {
  const response = await sendRuntimeMessage<{ ok: boolean; delayMs: number; error?: string }, { delayMs: number }>({
    source: 'veles-ui',
    action: 'update-delay',
    payload: { delayMs },
  });

  if (!response.ok) {
    throw new Error(response.error ?? 'Не удалось обновить задержку запросов.');
  }

  return response;
};
