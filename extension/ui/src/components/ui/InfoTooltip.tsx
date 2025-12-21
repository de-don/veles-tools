import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import type { CSSProperties, ReactNode } from 'react';

export interface InfoTooltipProps {
  text: ReactNode;
  className?: string;
  icon?: ReactNode;
  placement?: TooltipPlacement;
  style?: CSSProperties;
}

export const InfoTooltip = ({ text, className, icon, placement = 'top', style }: InfoTooltipProps) => {
  const mergedClassName = ['info-tooltip', className].filter(Boolean).join(' ');

  return (
    <Tooltip title={text} placement={placement} overlayClassName="info-tooltip__overlay">
      <span className={mergedClassName} aria-hidden style={style}>
        {icon ?? <QuestionCircleOutlined className="info-tooltip__icon" />}
      </span>
    </Tooltip>
  );
};

export default InfoTooltip;
