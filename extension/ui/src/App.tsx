import { HashRouter, Route, Routes } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout, { type ConnectionStatus } from './components/AppLayout';
import HomePage from './pages/HomePage';
import BotsPage from './pages/BotsPage';
import BacktestsPage from './pages/BacktestsPage';
import { isExtensionRuntime, pingConnection, readConnectionStatus, updateRequestDelay } from './lib/extensionMessaging';

const REQUEST_DELAY_STORAGE_KEY = 'veles:request-delay-ms';
const DEFAULT_REQUEST_DELAY = 300;

const App = () => {
  const extensionReady = useMemo(isExtensionRuntime, []);
  const [requestDelay, setRequestDelay] = useState<number>(() => {
    try {
      const stored = window.localStorage.getItem(REQUEST_DELAY_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_REQUEST_DELAY;
      }
      const parsed = Number(stored);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REQUEST_DELAY;
    } catch (error) {
      console.warn('[Veles UI] Unable to read request delay from storage', error);
      return DEFAULT_REQUEST_DELAY;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(REQUEST_DELAY_STORAGE_KEY, String(requestDelay));
    } catch (error) {
      console.warn('[Veles UI] Unable to persist request delay', error);
    }
  }, [requestDelay]);

  useEffect(() => {
    if (!extensionReady) {
      return;
    }

    updateRequestDelay(requestDelay).catch((error) => {
      console.warn('[Veles UI] Unable to update request delay in background', error);
    });
  }, [extensionReady, requestDelay]);

  const handleDelayChange = (value: number) => {
    const normalized = Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
    setRequestDelay(normalized);
  };

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    ok: false,
    lastChecked: null,
    error: 'нет данных',
  });

  const refreshConnectionStatus = useCallback(async () => {
    if (!extensionReady) {
      setConnectionStatus({ ok: false, lastChecked: Date.now(), error: 'интерфейс вне расширения' });
      return;
    }

    const status = await readConnectionStatus();
    setConnectionStatus({ ok: status.ok, lastChecked: status.timestamp || Date.now(), error: status.error });
  }, [extensionReady]);

  const triggerPing = useCallback(async () => {
    const result = await pingConnection();
    if (!result.ok) {
      setConnectionStatus({ ok: false, lastChecked: Date.now(), error: result.error ?? 'нет ответа' });
      return;
    }
    await refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  useEffect(() => {
    refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  useEffect(() => {
    if (!extensionReady) {
      return;
    }
    triggerPing().catch((error) => {
      console.warn('[Veles UI] ping failed', error);
    });
  }, [extensionReady, triggerPing]);

  useEffect(() => {
    if (!extensionReady || typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }

    const listener = (message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        'source' in message &&
        (message as { source?: string }).source === 'veles-background'
      ) {
        const payload = message as { action?: string; payload?: { ok?: boolean; timestamp?: number; error?: string } };
        if (payload.action === 'connection-status-update') {
          const snapshot = payload.payload ?? {};
          setConnectionStatus({
            ok: Boolean(snapshot.ok),
            lastChecked: snapshot.timestamp ?? Date.now(),
            error: snapshot.error,
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [extensionReady]);

  return (
    <HashRouter>
      <AppLayout
        extensionReady={extensionReady}
        requestDelay={requestDelay}
        onDelayChange={handleDelayChange}
        connectionStatus={connectionStatus}
        onPing={triggerPing}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bots" element={<BotsPage extensionReady={extensionReady} />} />
          <Route path="/backtests" element={<BacktestsPage extensionReady={extensionReady} />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  );
};

export default App;
