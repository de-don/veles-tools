import type { SelectProps } from 'antd';
import { Button, Checkbox, Flex, Input, Modal, Progress, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { fetchApiKeys } from '../api/apiKeys';
import type { CreateBotResponse } from '../api/bots';
import { createBot, startBot } from '../api/bots';
import { type BotCreationOverrides, buildBotCreationPayload } from '../lib/backtestBotPayload';
import { parseNumericInput } from '../lib/numericInput';
import { formatReinvestInput, isReinvestEnabled, parseReinvestInput, resolveReinvestMaxPercent } from '../lib/reinvest';
import type { ApiKey } from '../types/apiKeys';
import type { BacktestDetail } from '../types/backtests';
import ReinvestField from './bots/ReinvestField';

export interface BacktestBotTarget {
  id: number;
  detail: BacktestDetail;
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

const MARGIN_OPTIONS: SelectProps<MarginType>['options'] = [
  { value: 'CROSS', label: 'CROSS' },
  { value: 'ISOLATED', label: 'ISOLATED' },
];

type MarginType = BotCreationOverrides['marginType'];

const normalizeMarginType = (value: string | null | undefined): MarginType => {
  if (typeof value !== 'string') {
    return 'CROSS';
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ISOLATED' || normalized === 'CROSS') {
    return normalized;
  }
  return 'CROSS';
};

const createLogId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const CreateBotsFromBacktestsModal = ({ open, targets, onClose, onCompleted }: CreateBotsFromBacktestsModalProps) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyId, setApiKeyId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLeverage, setDepositLeverage] = useState('');
  const [marginType, setMarginType] = useState<MarginType>('CROSS');
  const [reinvestEnabled, setReinvestEnabled] = useState(false);
  const [reinvestValue, setReinvestValue] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);

  const totalTargets = targets.length;

  const reinvestMaxPercent = useMemo(
    () => resolveReinvestMaxPercent(targets.map((target) => target.detail.config.exchange)),
    [targets],
  );

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
        setLogs((prev) => [
          ...prev,
          {
            id: createLogId(),
            level: 'error',
            message: `Не удалось загрузить API-ключи: ${message}`,
          },
        ]);
      })
      .finally(() => {
        setApiKeysLoading(false);
      });
  }, [open, apiKeyId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstDetail = targets[0]?.detail;
    const depositConfig = firstDetail?.config.deposit ?? null;
    if (depositConfig) {
      const { amount, leverage, marginType: detailMargin } = depositConfig;
      setDepositAmount(String(amount));
      setDepositLeverage(String(leverage));
      setMarginType(normalizeMarginType(detailMargin));
      setReinvestEnabled(isReinvestEnabled(depositConfig.reinvest));
      setReinvestValue(formatReinvestInput(depositConfig.reinvest));
    } else {
      setDepositAmount('');
      setDepositLeverage('');
      setMarginType('CROSS');
      setReinvestEnabled(false);
      setReinvestValue('');
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
    const reinvest = parseReinvestInput(reinvestEnabled, reinvestValue, reinvestMaxPercent);
    if (!reinvest.ok) {
      setError(reinvest.error);
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
      reinvest: reinvest.value,
    };

    let succeeded = 0;
    let failed = 0;

    const resolveName = (detail: BacktestDetail) => {
      const configName = detail.config.name;
      if (configName.trim().length > 0) {
        return configName.trim();
      }
      const statsName = detail.statistics.name;
      if (statsName.trim().length > 0) {
        return statsName.trim();
      }
      return `Backtest ${detail.statistics.id}`;
    };

    for (const target of targets) {
      const { detail } = target;

      const displayName = resolveName(detail);
      appendLog('info', `Создаём бота по бэктесту ${displayName} (ID: ${target.id})...`);

      try {
        const payload = buildBotCreationPayload(detail, overrides);
        const response: CreateBotResponse = await createBot(payload);
        const botId = response.id;
        appendLog('success', `✅ Бот создан (ID: ${botId}).`);
        succeeded += 1;

        if (autoStart) {
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
        appendLog('error', `Ошибка создания бота для ${displayName}: ${message}`);
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
        <label className="form-label" htmlFor="create-bots-api-key">
          API-ключ
        </label>
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
          className="u-full-width"
        />
      </div>

      <div className="form-grid form-grid--compact">
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-deposit">
            Депозит
          </label>
          <Input
            id="create-bots-deposit"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            disabled={isRunning}
            placeholder="Например 1000"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-leverage">
            Плечо
          </label>
          <Input
            id="create-bots-leverage"
            value={depositLeverage}
            onChange={(event) => setDepositLeverage(event.target.value)}
            disabled={isRunning}
            placeholder="Например 10"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="create-bots-margin">
            Маржа
          </label>
          <Select<MarginType>
            id="create-bots-margin"
            value={marginType}
            onChange={(value) => setMarginType(value)}
            options={MARGIN_OPTIONS}
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="u-mt-16">
        <ReinvestField
          id="create-bots-reinvest"
          enabled={reinvestEnabled}
          value={reinvestValue}
          maxPercent={reinvestMaxPercent}
          disabled={isRunning}
          onEnabledChange={setReinvestEnabled}
          onValueChange={setReinvestValue}
        />
      </div>

      <Checkbox
        checked={autoStart}
        disabled={isRunning}
        onChange={(event) => setAutoStart(event.target.checked)}
        className="u-mt-16"
      >
        Запустить после создания
      </Checkbox>

      {error && <div className="form-error u-mt-12">{error}</div>}

      {isRunning && (
        <div className="run-log u-mt-16">
          <Flex className="run-log__progress modal-progress" vertical gap={8}>
            <span>
              Выполнено {processed} из {totalTargets}
            </span>
            <Progress percent={percent} size="small" showInfo={false} />
          </Flex>
        </div>
      )}

      {logs.length > 0 && (
        <div className="modal-log u-mt-16">
          <ul className="modal-log__list">
            {logs.map((entry) => (
              <li key={entry.id} className={`modal-log__entry modal-log__entry--${entry.level}`}>
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Flex justify="flex-end" gap={8} className="u-mt-20">
        <Button onClick={handleCancel} disabled={isRunning}>
          Отменить
        </Button>
        <Button
          type="primary"
          onClick={runCreation}
          disabled={isRunning || totalTargets === 0 || !apiKeyId}
          loading={isRunning}
        >
          {isRunning ? 'Создаём…' : `Создать ботов (${totalTargets})`}
        </Button>
      </Flex>
    </Modal>
  );
};

export default CreateBotsFromBacktestsModal;
