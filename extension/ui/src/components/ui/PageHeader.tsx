import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  tags?: ReactNode;
  extra?: ReactNode;
  onBack?: () => void;
  className?: string;
}

export const PageHeader = ({ title, description, tags, extra, onBack, className }: PageHeaderProps) => {
  return (
    <header className={className ?? 'page__header'}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 auto' }}>
          {onBack ? (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              type="text"
              shape="circle"
              aria-label="Назад"
              style={{ minWidth: 32, width: 32, height: 32 }}
            />
          ) : null}
          <div className="page__title">{title}</div>
        </div>
        {extra ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{extra}</div>
        ) : null}
      </div>
      {tags ? <div style={{ marginTop: 8 }}>{tags}</div> : null}
      {description ? (
        <p className="page__subtitle" style={{ marginTop: tags ? 8 : 12 }}>
          {description}
        </p>
      ) : null}
    </header>
  );
};

export default PageHeader;
