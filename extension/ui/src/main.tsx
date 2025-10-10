import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import 'antd/dist/reset.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider locale={ruRU} theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
