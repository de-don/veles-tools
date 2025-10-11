import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Input, Modal, Select } from 'antd';
import type { SelectProps } from 'antd';
import type { BacktestStatisticsDetail } from '../types/backtests';
import type { ApiKey } from '../types/apiKeys';
import { fetchApiKeys } from '../api/apiKeys';
import { createBot, startBot } from '../api/bots';
import { buildBotCreationPayload, type BotCreationOverrides } from '../lib/backtestBotPayload';
import type { CreateBotResponse } from '../api/bots';

export interface BacktestBotTarget {
  id: number;
  detail: BacktestStatisticsDetail;
}

interface CreateBotsFromBacktestsModalProps {
  open: boolean;
  targets: BacktestBotTarget[];
  onClose: () => void;
  onCompleted?: (summary: { succeeded: number; failed: number }) => void;
}

type LogLevel = 'info' | 'success' | 'error';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
}

const MARGIN_OPTIONS: SelectProps<string>['options'] = [
  { value: 'CROSS', label: 'CROSS' },
  { value: 'ISOLATED', label: 'ISOLATED' },
];

const sanitizeNumberInput = (value: string): string => {
  return value.replace(/[\s_]/g, '').replace(',', '.');
};

const parseNumericInput = (value: string): number | null => {
  const normalized = sanitizeNumberInput(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const createLogId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const CreateBotsFromBacktestsModal = ({ open, targets, onClose, onCompleted }: CreateBotsFromBacktestsModalProps) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyId, setApiKeyId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLeverage, setDepositLeverage] = useState('');
  const [marginType, setMarginType] = useState('CROSS');
  const [autoStart, setAutoStart] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);

  const totalTargets = targets.length;

  useEffect(() => {
    if (!open) {
      return;
    }

    setApiKeysLoading(true);
    fetchApiKeys()
      .then((items) => {
        setApiKeys(items);
        if (!apiKeyId && items.length > 0) {
          setApiKeyId(items[0].id);
        }
      })
      .catch((apiError: unknown) => {
        const message = apiError instanceof Error ? apiError.message : String(apiError);
        setLogs((prev) => [...prev, { id: createLogId(), level: 'error', message: `Не удалось загрузить API-ключи: ${message}` }]);
      })
      .finally(() => {
        setApiKeysLoading(false);
      });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstDetail = targets[0]?.detail;
    if (firstDetail?.deposit) {
      const { amount, leverage, marginType: detailMargin } = firstDetail.deposit;
      if (amount !== null && amount !== undefined) {
        setDepositAmount(String(amount));
      }
      if (leverage !== null && leverage !== undefined) {
        setDepositLeverage(String(leverage));
      }
      if (typeof detailMargin === 'string' && detailMargin.trim()) {
        setMarginType(detailMargin.trim().toUpperCase());
      }
    } else {
      setDepositAmount('');
      setDepositLeverage('');
      setMarginType('CROSS');
    }
    setLogs([]);
    setProcessed(0);
    setIsRunning(false);
    setError(null);
    setAutoStart(false);
  }, [open, targets]);

  const percent = useMemo(() => {
    if (totalTargets === 0) {
      return 0;
    }
    return Math.floor((processed / totalTargets) * 100);
  }, [processed, totalTargets]);

  const appendLog = (level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, { id: createLogId(), level, message }]);
  };

  const handleCancel = () => {
    if (isRunning) {
      return;
    }
    onClose();
  };

  const runCreation = async () => {
    if (isRunning || totalTargets === 0) {
      return;
    }

    const normalizedAmount = parseNumericInput(depositAmount ?? '');
    const normalizedLeverage = parseNumericInput(depositLeverage ?? '');

    if (!apiKeyId) {
      setError('Выберите API-ключ.');
      return;
    }
    if (normalizedAmount === null || normalizedAmount <= 0) {
      setError('Введите корректный депозит.');
      return;
    }
    if (normalizedLeverage === null || normalizedLeverage <= 0) {
      setError('Введите корректное значение плеча.');
      return;
    }

    setError(null);
    setIsRunning(true);
    setLogs([]);
    setProcessed(0);

    const overrides: BotCreationOverrides = {
      apiKeyId,
      depositAmount: normalizedAmount,
      depositLeverage: normalizedLeverage,
      marginType,
    };

    let succeeded = 0;
    let failed = 0;

    for (const target of targets) {
      const { detail } = target;
      if (!detail) {
        appendLog('error', `Бэктест ${target.id}: отсутствуют детали для создания бота.`);
        failed += 1;
        setProcessed((prev) => prev + 1);
        // eslint-disable-next-line no-continue -- требуется пропустить элемент
        continue;
      }

      appendLog('info', `Создаём бота по бэктесту ${detail.name ?? target.id} (ID: ${target.id})...`);

      try {
        const payload = buildBotCreationPayload(detail, overrides);
        const response: CreateBotResponse = await createBot(payload);
        const botId = response.id;
        appendLog('success', `✅ Бот создан (ID: ${botId}).`);
        succeeded += 1;

        if (autoStart && typeof botId === 'number') {
          try {
            await startBot(botId);
            appendLog('success', `🚀 Бот ${botId} запущен.`);
          } catch (startError) {
            const message = startError instanceof Error ? startError.message : String(startError);
            appendLog('error', `Не удалось запустить бота ${botId}: ${message}`);
          }
        }
      } catch (creationError) {
        const message = creationError instanceof Error ? creationError.message : String(creationError);
        appendLog('error', `Ошибка создания бота для ${detail.name ?? target.id}: ${message}`);
        failed += 1;
      } finally {
        setProcessed((prev) => prev + 1);
      }
    }

    setIsRunning(false);
    if (onCompleted) {
      onCompleted({ succeeded, failed });
    }
  };

  return (
    <Modal
      open={open}
      title="Создать ботов из бэктестов"
      onCancel={handleCancel}
      footer={null}
      maskClosable={!isRunning}
      destroyOnClose
    >
      <div className="form-field">
        <label className="form-label" htmlFor="create-bots-api-key">API-ключ</label>
        <Select<number>
          id="create-bots-api-key"
          showSearch
          placeholder="Выберите API-ключ"
          value={apiKeyId ?? undefined}
          loading={apiKeysLoading}
          onChange={(value) => setApiKeyId(value)}
          optionFilterProp="label"
          options={apiKeys.map((key) => ({
            label: `${key.name} (${key.exchange})`,
            value: key.id,
          }))}
          disabled={isRunning || apiKeys.length === 0}
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-deposit">Депозит</label>
          <Input
            id="create-bots-deposit"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            disabled={isRunning}
            placeholder="Например 1000"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-leverage">Плечо</label>
          <Input
            id="create-bots-leverage"
            value={depositLeverage}
            onChange={(event) => setDepositLeverage(event.target.value)}
            disabled={isRunning}
            placeholder="Например 10"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-margin">Маржа</label>
          <Select<string>
            id="create-bots-margin"
            value={marginType}
            onChange={(value) => setMarginType(value)}
            options={MARGIN_OPTIONS}
            disabled={isRunning}
          />
        </div>
      </div>

      <Checkbox
        checked={autoStart}
        disabled={isRunning}
        onChange={(event) => setAutoStart(event.target.checked)}
        style={{ marginTop: 16 }}
      >
        Запустить после создания
      </Checkbox>

      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

      {isRunning && (
        <div className="run-log" style={{ marginTop: 16 }}>
          <div className="run-log__progress">
            <span>
              Выполнено {processed} из {totalTargets}
            </span>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 6, padding: 12 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {logs.map((entry) => (
              <li
                key={entry.id}
                style={{
                  color:
                    entry.level === 'error' ? '#f87171' : entry.level === 'success' ? '#34d399' : '#cbd5f5',
                  marginBottom: 6,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button type="button" className="button button--ghost" onClick={handleCancel} disabled={isRunning}>
          Отменить
        </button>
        <button
          type="button"
          className="button"
          onClick={runCreation}
          disabled={isRunning || totalTargets === 0 || !apiKeyId}
        >
          {isRunning ? 'Создаём…' : `Создать ботов (${totalTargets})`}
        </button>
      </div>
    </Modal>
  );
};

export default CreateBotsFromBacktestsModal;
