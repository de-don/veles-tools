import { Space } from 'antd';
import type { ReactNode } from 'react';

interface SelectionSummaryBarProps {
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const SelectionSummaryBar = ({ message, actions, className }: SelectionSummaryBarProps) => {
  const containerClassName = className ? `selection-summary ${className}` : 'selection-summary';

  return (
    <div className={containerClassName}>
      <div className="selection-summary__message">{message}</div>
      {actions ? (
        <Space size="middle" wrap className="selection-summary__actions">
          {actions}
        </Space>
      ) : null}
    </div>
  );
};

export default SelectionSummaryBar;
