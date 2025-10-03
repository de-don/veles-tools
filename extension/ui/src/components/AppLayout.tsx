import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

interface AppLayoutProps extends PropsWithChildren {
  extensionReady: boolean;
  requestDelay: number;
  onDelayChange: (value: number) => void;
}

const AppLayout = ({ children, extensionReady, requestDelay, onDelayChange }: AppLayoutProps) => {
  return (
    <div className="app">
      <aside className="app__sidebar">
        <div className="sidebar__brand">Veles Tools</div>
        <nav className="sidebar__nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Главная
          </NavLink>
          <NavLink to="/bots" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Боты
          </NavLink>
        </nav>
        {!extensionReady && (
          <div className="sidebar__hint">
            Расширение не активно. Запросы будут недоступны, пока UI не открыт из расширения.
          </div>
        )}
        <div className="sidebar__controls">
          <label className="sidebar__control-label" htmlFor="request-delay">
            Задержка между запросами (мс)
          </label>
          <input
            id="request-delay"
            type="number"
            min={0}
            step={50}
            value={requestDelay}
            onChange={(event) => onDelayChange(Number(event.target.value) || 0)}
            className="sidebar__control-input"
          />
        </div>
      </aside>
      <main className="app__content">{children}</main>
    </div>
  );
};

export default AppLayout;
