import { Alert, Button, Card, InputNumber, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useDealsRefresh } from '../context/DealsRefreshContext';
import { useRequestDelay } from '../context/RequestDelayContext';
import type { ActiveDealsRefreshInterval } from '../lib/activeDealsPolling';
import { clearBacktestCache } from '../storage/backtestCache';
import {
  DEFAULT_V2_BACKTEST_DELAY_MS,
  normalizeBacktestV2LaunchDelay,
  readBacktestV2LaunchDelay,
  writeBacktestV2LaunchDelay,
} from '../storage/backtestLaunchDelayStore';
import { normalizeRequestDelay } from '../storage/requestDelayStore';

const SettingsPage = () => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { delayMs, setDelayMs, defaultDelayMs } = useRequestDelay();
  const [requestDelayDraft, setRequestDelayDraft] = useState<number>(delayMs);
  const { refreshInterval: dealsRefreshInterval, setRefreshInterval, defaultInterval, options } = useDealsRefresh();
  const [dealsRefreshDraft, setDealsRefreshDraft] = useState<ActiveDealsRefreshInterval>(dealsRefreshInterval);
  const [v2DelayMs, setV2DelayMs] = useState<number>(() => readBacktestV2LaunchDelay() ?? DEFAULT_V2_BACKTEST_DELAY_MS);
  const [v2DelayDraft, setV2DelayDraft] = useState<number>(v2DelayMs);

  useEffect(() => {
    setRequestDelayDraft(delayMs);
  }, [delayMs]);

  useEffect(() => {
    setDealsRefreshDraft(dealsRefreshInterval);
  }, [dealsRefreshInterval]);

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

  const handleV2DelayChange = (value: number | null) => {
    setV2DelayDraft(value ?? 0);
  };

  const handleV2DelayBlur = () => {
    setV2DelayDraft((prev) => normalizeBacktestV2LaunchDelay(prev));
  };

  const handleV2DelaySave = () => {
    setV2DelayDraft((prev) => {
      const saved = writeBacktestV2LaunchDelay(prev);
      setV2DelayMs(saved);
      return saved;
    });
  };

  const handleV2DelayReset = () => {
    const saved = writeBacktestV2LaunchDelay(DEFAULT_V2_BACKTEST_DELAY_MS);
    setV2DelayDraft(saved);
    setV2DelayMs(saved);
  };

  const normalizedDraft = normalizeRequestDelay(requestDelayDraft);
  const saveDisabled = normalizedDraft === delayMs;
  const resetDisabled = delayMs === defaultDelayMs && normalizedDraft === defaultDelayMs;
  const normalizedV2Draft = normalizeBacktestV2LaunchDelay(v2DelayDraft);
  const v2SaveDisabled = normalizedV2Draft === v2DelayMs;
  const v2ResetDisabled =
    v2DelayMs === DEFAULT_V2_BACKTEST_DELAY_MS && normalizedV2Draft === DEFAULT_V2_BACKTEST_DELAY_MS;
  const dealsSaveDisabled = dealsRefreshDraft === dealsRefreshInterval;
  const dealsResetDisabled = dealsRefreshInterval === defaultInterval && dealsRefreshDraft === defaultInterval;

  return (
    <div className="page">
      <Space direction="vertical" size={24} className="u-full-width">
        <Space direction="vertical" size={4} className="page__header">
          <Typography.Title level={1} className="page__title">
            Настройки
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="page__subtitle">
            Управление локальными кэшами и вспомогательными параметрами.
          </Typography.Paragraph>
        </Space>

        <Card title="Запросы к API" bordered>
          <Space direction="vertical" size={16} className="u-full-width">
            <Typography.Paragraph className="u-mb-0">
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

        <Card title="Задержка между запуском бектестов (v2)" bordered>
          <Space direction="vertical" size={16} className="u-full-width">
            <Typography.Paragraph className="u-mb-0">
              Пауза между последовательными запусками бектестов через API v2. По умолчанию —{' '}
              {DEFAULT_V2_BACKTEST_DELAY_MS} мс. Если часто получаете ответ 429 (Too Many Requests) при запуске,
              увеличьте значение.
            </Typography.Paragraph>
            <Space size={12} align="center" wrap>
              <InputNumber
                min={0}
                step={500}
                value={v2DelayDraft}
                onChange={handleV2DelayChange}
                onBlur={handleV2DelayBlur}
                onPressEnter={handleV2DelaySave}
                addonAfter="мс"
              />
              <Button type="primary" onClick={handleV2DelaySave} disabled={v2SaveDisabled}>
                Сохранить
              </Button>
              <Button onClick={handleV2DelayReset} disabled={v2ResetDisabled}>
                Сбросить к {DEFAULT_V2_BACKTEST_DELAY_MS} мс
              </Button>
            </Space>
            <Typography.Text type="secondary">
              Применяется при следующем запуске. Влияет только на API v2.
            </Typography.Text>
          </Space>
        </Card>

        <Card title="Период подгрузки сделок" bordered>
          <Space direction="vertical" size={16} className="u-full-width">
            <Typography.Paragraph className="u-mb-0">
              Определяет частоту обновления активных сделок и автоматических проверок блокировок. Значение применяется
              глобально для всех разделов.
            </Typography.Paragraph>
            <Space size={12} align="center" wrap>
              <Select
                className="u-min-w-160"
                value={dealsRefreshDraft}
                onChange={(value: ActiveDealsRefreshInterval) => setDealsRefreshDraft(value)}
                options={options.map((value) => ({ value, label: `${value} сек` }))}
              />
              <Button type="primary" onClick={() => setRefreshInterval(dealsRefreshDraft)} disabled={dealsSaveDisabled}>
                Сохранить
              </Button>
              <Button
                onClick={() => {
                  setDealsRefreshDraft(defaultInterval);
                  setRefreshInterval(defaultInterval);
                }}
                disabled={dealsResetDisabled}
              >
                Сбросить к {defaultInterval} сек
              </Button>
            </Space>
          </Space>
        </Card>

        <Card title="Очистка данных" bordered>
          <Space direction="vertical" size={16} className="u-full-width">
            <Typography.Paragraph className="u-mb-0">
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
