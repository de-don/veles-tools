import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';
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
  const descriptionClassName = ['page-header__description', tags ? 'page-header__description--with-tags' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={className ?? 'page__header'}>
      <Flex className="page-header__row" align="center" justify="space-between" wrap gap={12}>
        <Flex className="page-header__title" align="center" gap={12} flex="1 1 auto">
          {onBack ? (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              type="text"
              shape="circle"
              aria-label="Назад"
              className="page-header__back-button"
            />
          ) : null}
          <div className="page__title">{title}</div>
        </Flex>
        {extra ? (
          <Flex className="page-header__extra" justify="flex-end" wrap gap={8}>
            {extra}
          </Flex>
        ) : null}
      </Flex>
      {tags ? <div className="page-header__tags">{tags}</div> : null}
      {description ? <p className={descriptionClassName}>{description}</p> : null}
    </header>
  );
};

export default PageHeader;
