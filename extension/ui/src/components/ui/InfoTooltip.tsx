import type { ReactNode } from 'react';

export interface InfoTooltipProps {
  text: string;
  className?: string;
  icon?: ReactNode;
}

export const InfoTooltip = ({ text, className, icon }: InfoTooltipProps) => {
  const content = icon ?? 'ⓘ';
  return (
    <span
      className={className ? `info-tooltip ${className}` : 'info-tooltip'}
      role="note"
      aria-label={text}
      title={text}
    >
      {content}
    </span>
  );
};

export default InfoTooltip;
