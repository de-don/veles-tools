import { Alert, Button, Card, Space, Typography } from 'antd';
import { useState } from 'react';
import { clearBacktestCache } from '../storage/backtestCache';

const SettingsPage = () => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClearCache = async () => {
    if (status === 'pending') {
      return;
    }
    setStatus('pending');
    setErrorMessage(null);
    try {
      await clearBacktestCache();
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatus('error');
    }
  };

  const statusNote = (() => {
    if (status === 'success') {
      return <Alert type="success" showIcon message="Кэш очищен." />;
    }
    if (status === 'error') {
      return (
        <Alert type="warning" showIcon message={`Не удалось очистить кэш: ${errorMessage ?? 'неизвестная ошибка'}.`} />
      );
    }
    return null;
  })();

  return (
    <div className="page">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Space direction="vertical" size={4} className="page__header">
          <Typography.Title level={1} style={{ marginBottom: 0 }}>
            Настройки
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="page__subtitle" style={{ marginBottom: 0 }}>
            Управление локальными кэшами и вспомогательными параметрами.
          </Typography.Paragraph>
        </Space>

        <Card title="Очистка данных" bordered>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              Удаляет сохранённые детальные данные бэктестов и их циклов из локального кэша. При повторном обращении
              информация будет загружена заново с сервера.
            </Typography.Paragraph>
            <Button type="primary" onClick={handleClearCache} loading={status === 'pending'}>
              Очистить кэш
            </Button>
            {statusNote}
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default SettingsPage;
