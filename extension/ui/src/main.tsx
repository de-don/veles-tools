import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd/dist/reset.css';
import './styles.css';

if (typeof window !== 'undefined' && window.self !== window.top) {
  throw new Error('UI embedded in iframe — aborting.');
}

const container = document.getElementById('root');
if (!(container instanceof HTMLElement)) {
  throw new Error('UI root container not found.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ConfigProvider locale={ruRU} theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
