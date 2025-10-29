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
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  };
  const mergedStyle = className ? style : { ...baseStyle, ...style };

  return (
    <Tooltip title={text} placement={placement} overlayStyle={{ maxWidth: 320 }}>
      <span className={className} aria-hidden style={mergedStyle}>
        {icon ?? <QuestionCircleOutlined style={{ color: 'var(--ant-color-primary-text, #1677ff)' }} />}
      </span>
    </Tooltip>
  );
};

export default InfoTooltip;
