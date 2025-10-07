import { useId, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ items, activeTabId, onTabChange, className }: TabsProps) => {
  const baseId = useId();

  if (items.length === 0) {
    return null;
  }

  const preferredActive = items.find((item) => item.id === activeTabId && !item.disabled);
  const fallbackActive = items.find((item) => !item.disabled) ?? items[0];
  const current = preferredActive ?? fallbackActive;
  const containerClassName = className ? `tabs ${className}` : 'tabs';

  return (
    <div className={containerClassName}>
      <div role="tablist" className="tabs__list">
        {items.map((item) => {
          const triggerId = `${baseId}-tab-${item.id}`;
          const panelId = `${baseId}-panel-${item.id}`;
          const isActive = current.id === item.id;
          return (
            <button
              key={item.id}
              id={triggerId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              className={`tabs__trigger${isActive ? ' tabs__trigger--active' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled && item.id !== current.id) {
                  onTabChange(item.id);
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="tabs__panel"
      >
        {current.content}
      </div>
    </div>
  );
};

export default Tabs;
