import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

interface AppLayoutProps extends PropsWithChildren {
  extensionReady: boolean;
  connectionStatus: ConnectionStatus;
  onPing: () => void;
}

export interface ConnectionStatus {
  ok: boolean;
  lastChecked: number | null;
  error?: string;
}

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString();
};

const AppLayout = ({ children, extensionReady, connectionStatus, onPing }: AppLayoutProps) => {
  return (
    <div className="app">
      <aside className="app__sidebar">
        <div className="sidebar__brand">Veles Tools</div>
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
        </nav>
        {!extensionReady && (
          <div className="sidebar__hint">
            Расширение не активно. Запросы будут недоступны, пока UI не открыт из расширения.
          </div>
        )}
        <div className="sidebar__controls">
          <div className={`status status--${connectionStatus.ok ? 'online' : 'offline'}`}>
            <div className="status__row">
              <div className="status__indicator" aria-hidden />
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
          </div>
        </div>
      </aside>
      <main className="app__content">{children}</main>
    </div>
  );
};

export default AppLayout;
