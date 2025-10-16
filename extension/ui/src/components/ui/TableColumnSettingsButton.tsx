import { ArrowDownOutlined, ArrowUpOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Checkbox, Popover } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useMemo, useState } from 'react';
import type { ColumnMoveDirection, ColumnSettingsItem } from '../../lib/useTableColumnSettings';
import 'antd/es/button/style';
import 'antd/es/checkbox/style';
import 'antd/es/popover/style';

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
        <div className="table-column-settings__list">
          {settings.map((item) => (
            <div key={item.key} className="table-column-settings__row">
              <Checkbox
                checked={item.visible}
                onChange={handleCheckboxChange(item.key)}
                disabled={item.visible && visibleColumnsCount <= requiredVisible}
              >
                {item.title}
              </Checkbox>
              <div className="table-column-settings__row-actions">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleMove(item.key, 'up')}
                  disabled={!item.canMoveUp}
                  aria-label={`Переместить «${item.title}» выше`}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMove(item.key, 'down')}
                  disabled={!item.canMoveDown}
                  aria-label={`Переместить «${item.title}» ниже`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="table-column-settings__footer">
          <Button type="link" onClick={handleReset} disabled={!hasCustomSettings} size="small">
            Сбросить
          </Button>
        </div>
      </div>
    );

  const buttonClassName = hasCustomSettings
    ? 'button button--ghost table-column-settings__button table-column-settings__button--active'
    : 'button button--ghost table-column-settings__button';

  return (
    <Popover trigger="click" open={opened} onOpenChange={setOpened} content={content} placement="bottomRight">
      <button type="button" className={buttonClassName} disabled={settings.length === 0}>
        <SettingOutlined style={{ marginRight: 6 }} />
        {label}
      </button>
    </Popover>
  );
};
