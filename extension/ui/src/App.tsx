import { FormEvent, useMemo, useState } from 'react';

interface ProxyRequestPayload {
  url: string;
  init?: RequestInit;
}

interface ProxyResponsePayload {
  requestId: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
  error?: string;
  headers?: Record<string, string>;
}

const isExtensionRuntime = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && Boolean(chrome.runtime.id);
};

const sendMessage = async <T,>(message: T): Promise<unknown> => {
  if (!isExtensionRuntime()) {
    throw new Error('Расширение не доступно. Запустите UI как часть расширения.');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response);
    });
  });
};

const proxyHttpRequest = async (payload: ProxyRequestPayload): Promise<ProxyResponsePayload> => {
  const response = (await sendMessage({
    source: 'veles-ui',
    action: 'proxy-request',
    payload,
  })) as ProxyResponsePayload;
  return response;
};

const App = () => {
  const [url, setUrl] = useState('https://veles.finance/api/example');
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<ProxyResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extensionReady = useMemo(isExtensionRuntime, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLastResponse(null);

    if (!extensionReady) {
      setError('Расширение не запущено. Соберите проект и откройте popup из расширения.');
      return;
    }

    if (!url.trim()) {
      setError('Введите URL.');
      return;
    }

    setLoading(true);
    try {
      const response = await proxyHttpRequest({ url: url.trim() });
      setLastResponse(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Veles Tools UI</h1>
        <p>React-панель, работающая в popup расширения. Запросы идут через страницу veles.finance.</p>
      </header>

      {!extensionReady && (
        <div className="app__warning">
          <strong>Режим разработки:</strong> запустите страницу как часть расширения, чтобы протестировать прокси-запросы.
        </div>
      )}

      <section className="card">
        <h2>Тестовый запрос</h2>
        <p className="card__description">
          Позже здесь появится выбор ботов и бэктестов. Сейчас можно проверить канал связи и получение данных.
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label className="form__label">
            URL запроса
            <input
              type="url"
              value={url}
              placeholder="https://veles.finance/api/..."
              onChange={(event) => setUrl(event.target.value)}
              className="form__input"
            />
          </label>
          <button type="submit" className="form__button" disabled={loading}>
            {loading ? 'Выполняю...' : 'Отправить через страницу'}
          </button>
        </form>

        {error && <div className="card__error">{error}</div>}

        {lastResponse && (
          <div className="card__response">
            <div>
              <span className="label">Статус:</span> {lastResponse.status ?? '—'} {lastResponse.statusText ?? ''}
            </div>
            <div>
              <span className="label">Успех:</span> {lastResponse.ok ? 'да' : 'нет'}
            </div>
            {lastResponse.error && (
              <div>
                <span className="label">Ошибка:</span> {lastResponse.error}
              </div>
            )}
            {lastResponse.body && (
              <pre className="card__code">{JSON.stringify(lastResponse.body, null, 2)}</pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default App;
