import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { APP_NAME, APP_VERSION } from '../config/version';
import logo from '../assets/logo.png';

interface AppLayoutProps extends PropsWithChildren {
  extensionReady: boolean;
  connectionStatus: ConnectionStatus;
  onPing: () => void;
  onOpenVeles: () => void;
}

export interface ConnectionStatus {
  ok: boolean;
  lastChecked: number | null;
  error?: string;
}

const REPOSITORY_URL = 'https://github.com/de-don/veles-tools';
const AUTHOR_URL = 'https://t.me/dontsov';

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString();
};

const AppLayout = ({ children, extensionReady, connectionStatus, onPing, onOpenVeles }: AppLayoutProps) => {
  return (
    <div className="app">
      <aside className="app__sidebar">
        <div className="sidebar__brand">
          <img className="sidebar__brand-logo" src={logo} alt="Veles Tools" />
          <div className="sidebar__brand-meta">
            <span>{APP_NAME}</span>
            <span className="sidebar__version">v{APP_VERSION}</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Главная
          </NavLink>
          <NavLink to="/bots" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Мои боты
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Импорт ботов
          </NavLink>
          <NavLink to="/backtests" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Бэктесты
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Настройки
          </NavLink>
        </nav>
        {!extensionReady && (
          <div className="sidebar__hint">
            Расширение Veles Tools неактивно. Запросы недоступны, пока интерфейс не открыт из меню расширения.
          </div>
        )}
        <div className="sidebar__controls">
          <a
            className="button button--ghost sidebar__donate"
            href="https://buymeacoffee.com/dedon"
            target="_blank"
            rel="noreferrer noopener"
          >
            Поддержать проект
          </a>
          <div className={`status status--${connectionStatus.ok ? 'online' : 'offline'}`}>
            <div className="status__row">
              <div className="status__details">
                <div className="status__label">Связь с вкладкой</div>
                <div className="status__value">
                  {connectionStatus.ok ? 'активна' : connectionStatus.error ?? 'нет соединения'}
                </div>
                <div className="status__meta">Обновлено: {formatTimestamp(connectionStatus.lastChecked)}</div>
              </div>
            </div>
            <button type="button" className="button button--ghost status__action" onClick={onPing}>
              Обновить
            </button>
            {!connectionStatus.ok && (
              <button type="button" className="button status__action" onClick={onOpenVeles}>
                Открыть veles.finance
              </button>
            )}
          </div>
          <div className="sidebar__meta">
            <a className="sidebar__meta-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
              Исходный код на GitHub
            </a>
            <a className="sidebar__meta-link" href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
              Автор: @dontsov
            </a>
          </div>
        </div>
      </aside>
      <main className="app__content">{children}</main>
    </div>
  );
};

export default AppLayout;
