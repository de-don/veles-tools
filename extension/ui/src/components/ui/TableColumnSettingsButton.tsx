import { ArrowDownOutlined, ArrowUpOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Checkbox, Popover, Space } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useMemo, useState } from 'react';
import type { ColumnMoveDirection, ColumnSettingsItem } from '../../lib/useTableColumnSettings';

interface TableColumnSettingsButtonProps {
  settings: ColumnSettingsItem[];
  moveColumn: (key: string, direction: ColumnMoveDirection) => void;
  setColumnVisibility: (key: string, visible: boolean) => void;
  reset: () => void;
  hasCustomSettings: boolean;
  minimumVisibleColumns?: number;
  label?: string;
}

export const TableColumnSettingsButton = ({
  settings,
  moveColumn,
  setColumnVisibility,
  reset,
  hasCustomSettings,
  minimumVisibleColumns = 1,
  label = 'Столбцы',
}: TableColumnSettingsButtonProps) => {
  const [opened, setOpened] = useState(false);

  const visibleColumnsCount = useMemo(() => settings.filter((item) => item.visible).length, [settings]);
  const requiredVisible = Math.max(1, minimumVisibleColumns);

  const handleCheckboxChange = (key: string) => (event: CheckboxChangeEvent) => {
    setColumnVisibility(key, event.target.checked);
  };

  const handleMove = (key: string, direction: ColumnMoveDirection) => {
    moveColumn(key, direction);
  };

  const handleReset = () => {
    reset();
    setOpened(false);
  };

  const content =
    settings.length === 0 ? (
      <div className="table-column-settings__empty">Нет доступных столбцов.</div>
    ) : (
      <div className="table-column-settings__content">
        <Space direction="vertical" size="small" className="table-column-settings__list">
          {settings.map((item) => (
            <Space key={item.key} className="table-column-settings__row" align="center">
              <Checkbox
                checked={item.visible}
                onChange={handleCheckboxChange(item.key)}
                disabled={item.visible && visibleColumnsCount <= requiredVisible}
              >
                {item.title}
              </Checkbox>
              <Space.Compact size="small">
                <Button
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleMove(item.key, 'up')}
                  disabled={!item.canMoveUp}
                  aria-label={`Переместить «${item.title}» выше`}
                />
                <Button
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMove(item.key, 'down')}
                  disabled={!item.canMoveDown}
                  aria-label={`Переместить «${item.title}» ниже`}
                />
              </Space.Compact>
            </Space>
          ))}
        </Space>
        <div className="table-column-settings__footer">
          <Button type="link" onClick={handleReset} disabled={!hasCustomSettings} size="small">
            Сбросить
          </Button>
        </div>
      </div>
    );

  return (
    <Popover trigger="click" open={opened} onOpenChange={setOpened} content={content} placement="bottomRight">
      <Button
        icon={<SettingOutlined />}
        type={hasCustomSettings ? 'primary' : 'default'}
        disabled={settings.length === 0}
      >
        {label}
      </Button>
    </Popover>
  );
};
