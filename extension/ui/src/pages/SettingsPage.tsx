import { Alert, Button, Card, InputNumber, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useRequestDelay } from '../context/RequestDelayContext';
import { clearBacktestCache } from '../storage/backtestCache';
import { normalizeRequestDelay } from '../storage/requestDelayStore';

const SettingsPage = () => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { delayMs, setDelayMs, defaultDelayMs } = useRequestDelay();
  const [requestDelayDraft, setRequestDelayDraft] = useState<number>(delayMs);

  useEffect(() => {
    setRequestDelayDraft(delayMs);
  }, [delayMs]);

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

  const handleDelayChange = (value: number | null) => {
    setRequestDelayDraft(value ?? 0);
  };

  const handleDelayBlur = () => {
    setRequestDelayDraft((prev) => normalizeRequestDelay(prev));
  };

  const handleDelaySave = () => {
    setRequestDelayDraft((prev) => {
      const normalized = normalizeRequestDelay(prev);
      setDelayMs(normalized);
      return normalized;
    });
  };

  const handleDelayReset = () => {
    setRequestDelayDraft(defaultDelayMs);
    setDelayMs(defaultDelayMs);
  };

  const normalizedDraft = normalizeRequestDelay(requestDelayDraft);
  const saveDisabled = normalizedDraft === delayMs;
  const resetDisabled = delayMs === defaultDelayMs && normalizedDraft === defaultDelayMs;

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

        <Card title="Запросы к API" bordered>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              Управляет задержкой между последовательными запросами. По умолчанию — {defaultDelayMs}
              мс. Если часто получаете ответ 429 (Too Many Requests), увеличьте значение. Не влияет на задержку между
              запуском бектестов.
            </Typography.Paragraph>
            <Space size={12} align="center" wrap>
              <InputNumber
                min={0}
                step={50}
                value={requestDelayDraft}
                onChange={handleDelayChange}
                onBlur={handleDelayBlur}
                onPressEnter={handleDelaySave}
                addonAfter="мс"
              />
              <Button type="primary" onClick={handleDelaySave} disabled={saveDisabled}>
                Сохранить
              </Button>
              <Button onClick={handleDelayReset} disabled={resetDisabled}>
                Сбросить к {defaultDelayMs} мс
              </Button>
            </Space>
            <Typography.Text type="secondary">
              Новое значение применяется немедленно и сохраняется в локальном хранилище.
            </Typography.Text>
          </Space>
        </Card>

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
