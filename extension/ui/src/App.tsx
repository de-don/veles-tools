import { useCallback, useEffect, useMemo, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppLayout, { type ConnectionStatus } from './components/AppLayout';
import { ActiveDealsProvider } from './context/ActiveDealsContext';
import { BacktestGroupsProvider } from './context/BacktestGroupsContext';
import { ImportedBotsProvider } from './context/ImportedBotsContext';
import { isExtensionRuntime, pingConnection, readConnectionStatus, updateRequestDelay } from './lib/extensionMessaging';
import ActiveDealsPage from './pages/ActiveDealsPage';
import BacktestGroupDetailsPage from './pages/BacktestGroupDetailsPage';
import BacktestGroupsPage from './pages/BacktestGroupsPage';
import BacktestsPage from './pages/BacktestsPage';
import BotsPage from './pages/BotsPage';
import HomePage from './pages/HomePage';
import ImportBotsPage from './pages/ImportBotsPage';
import SettingsPage from './pages/SettingsPage';

const DEFAULT_REQUEST_DELAY = 300;

const App = () => {
  const extensionReady = useMemo(isExtensionRuntime, []);
  const requestDelay = DEFAULT_REQUEST_DELAY;

  useEffect(() => {
    if (!extensionReady) {
      return;
    }

    updateRequestDelay(requestDelay).catch((error) => {
      console.warn('[Veles Tools] Unable to update request delay in background', error);
    });
  }, [extensionReady, requestDelay]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    ok: false,
    lastChecked: null,
    error: 'нет данных',
    origin: null,
  });

  const refreshConnectionStatus = useCallback(async () => {
    if (!extensionReady) {
      setConnectionStatus({
        ok: false,
        lastChecked: Date.now(),
        error: 'интерфейс вне расширения',
        origin: null,
      });
      return;
    }

    const status = await readConnectionStatus();
    setConnectionStatus({
      ok: status.ok,
      lastChecked: status.timestamp || Date.now(),
      error: status.error,
      origin: status.origin ?? null,
    });
  }, [extensionReady]);

  const triggerPing = useCallback(async () => {
    const result = await pingConnection();
    if (!result.ok) {
      setConnectionStatus((prev) => ({
        ok: false,
        lastChecked: Date.now(),
        error: result.error ?? 'нет ответа',
        origin: prev.origin ?? null,
      }));
      return;
    }
    await refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  const openVelesTab = useCallback(() => {
    const targetUrl = 'https://veles.finance/cabinet';

    if (!extensionReady || typeof chrome === 'undefined' || !chrome.tabs?.create) {
      window.open(targetUrl, '_blank', 'noopener');
      return;
    }

    try {
      chrome.tabs.create({ url: targetUrl }, () => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          console.warn('[Veles Tools] unable to open veles tab', lastError);
        }
      });
    } catch (error) {
      console.warn('[Veles Tools] unable to open veles tab', error);
      window.open(targetUrl, '_blank', 'noopener');
    }
  }, [extensionReady]);

  useEffect(() => {
    refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  useEffect(() => {
    if (!extensionReady) {
      return;
    }
    triggerPing().catch((error) => {
      console.warn('[Veles Tools] ping failed', error);
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
        const payload = message as {
          action?: string;
          payload?: {
            ok?: boolean;
            timestamp?: number;
            error?: string;
            origin?: string | null;
          };
        };
        if (payload.action === 'connection-status-update') {
          const snapshot = payload.payload ?? {};
          setConnectionStatus((prev) => ({
            ok: Boolean(snapshot.ok),
            lastChecked: snapshot.timestamp ?? Date.now(),
            error: snapshot.error,
            origin: snapshot.origin ?? prev.origin ?? null,
          }));
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [extensionReady]);

  useEffect(() => {
    if (typeof window !== 'undefined' && connectionStatus.origin) {
      (window as unknown as { __VELES_ACTIVE_ORIGIN?: string }).__VELES_ACTIVE_ORIGIN = connectionStatus.origin;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('__VELES_ACTIVE_ORIGIN', connectionStatus.origin);
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [connectionStatus.origin]);

  return (
    <HashRouter>
      <ImportedBotsProvider>
        <ActiveDealsProvider extensionReady={extensionReady}>
          <BacktestGroupsProvider>
            <AppLayout
              extensionReady={extensionReady}
              connectionStatus={connectionStatus}
              onPing={triggerPing}
              onOpenVeles={openVelesTab}
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/active-deals" element={<ActiveDealsPage extensionReady={extensionReady} />} />
                <Route path="/bots" element={<BotsPage extensionReady={extensionReady} />} />
                <Route path="/backtests" element={<BacktestsPage extensionReady={extensionReady} />} />
                <Route path="/backtest-groups" element={<BacktestGroupsPage />} />
                <Route
                  path="/backtest-groups/:groupId"
                  element={<BacktestGroupDetailsPage extensionReady={extensionReady} />}
                />
                <Route path="/import" element={<ImportBotsPage extensionReady={extensionReady} />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppLayout>
          </BacktestGroupsProvider>
        </ActiveDealsProvider>
      </ImportedBotsProvider>
    </HashRouter>
  );
};

export default App;
