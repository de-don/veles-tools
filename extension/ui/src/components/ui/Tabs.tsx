import type { TabsProps as AntdTabsProps } from 'antd';
import { Tabs as AntdTabs } from 'antd';
import { useMemo } from 'react';

type AntdTabItems = NonNullable<AntdTabsProps['items']>;
type AntdTabItem = AntdTabItems[number];

export interface TabItem {
  id: string;
  label: AntdTabItem['label'];
  content: AntdTabItem['children'];
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  className?: string;
  size?: AntdTabsProps['size'];
  tabPosition?: AntdTabsProps['tabPosition'];
}

export const Tabs = ({ items, activeTabId, onTabChange, className, size = 'large', tabPosition }: TabsProps) => {
  const effectiveActiveId = useMemo(() => {
    if (items.length === 0) {
      return '';
    }

    const preferred = items.find((item) => item.id === activeTabId && !item.disabled);
    if (preferred) {
      return preferred.id;
    }

    const firstEnabled = items.find((item) => !item.disabled);
    return (firstEnabled ?? items[0]).id;
  }, [activeTabId, items]);

  const tabsItems = useMemo<AntdTabItems>(
    () =>
      items.map<AntdTabItem>((item) => ({
        key: item.id,
        label: item.label,
        children: item.content,
        disabled: item.disabled,
      })),
    [items],
  );

  if (tabsItems.length === 0) {
    return null;
  }

  return (
    <AntdTabs
      className={className}
      activeKey={effectiveActiveId}
      items={tabsItems}
      onChange={onTabChange}
      size={size}
      tabPosition={tabPosition}
    />
  );
};

export default Tabs;
