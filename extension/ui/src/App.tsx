import { HashRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import BotsPage from './pages/BotsPage';
import { isExtensionRuntime, updateRequestDelay } from './lib/extensionMessaging';

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

  return (
    <HashRouter>
      <AppLayout extensionReady={extensionReady} requestDelay={requestDelay} onDelayChange={handleDelayChange}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bots" element={<BotsPage extensionReady={extensionReady} />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  );
};

export default App;
