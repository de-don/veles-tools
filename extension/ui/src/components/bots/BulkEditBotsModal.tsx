import { Alert, Button, Checkbox, Input, Modal, Progress, Typography } from 'antd';
import type { ProgressProps } from 'antd/es/progress';
import { useEffect, useMemo, useState } from 'react';
import { updateBot } from '../../api/bots';
import { type BotUpdateOverrides, buildBotUpdatePayload } from '../../lib/botUpdatePayload';
import { parseNumericInput } from '../../lib/numericInput';
import type { TradingBot } from '../../types/bots';
import type { BulkActionResult } from './BulkActionModal';

const { Paragraph, Text } = Typography;

interface BulkEditBotsModalProps {
  open: boolean;
  bots: TradingBot[];
  onClose: () => void;
  onCompleted?: (result: BulkActionResult) => void;
}

const DEFAULT_PROGRESS_LABEL = 'Обработано';

const pickErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const buildPercent = (processed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Math.round((processed / total) * 100);
};

const resolveProgressStatus = (isRunning: boolean, result: BulkActionResult | null): ProgressProps['status'] => {
  if (isRunning) {
    return 'active';
  }
  if (!result) {
    return 'normal';
  }
  return result.failed.length > 0 ? 'exception' : 'success';
};

const normalizeNumberValue = (value: number | string | null | undefined): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return '';
};

const BulkEditBotsModal = ({ open, bots, onClose, onCompleted }: BulkEditBotsModalProps) => {
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [depositValue, setDepositValue] = useState('');
  const [leverageEnabled, setLeverageEnabled] = useState(true);
  const [leverageValue, setLeverageValue] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResult | null>(null);

  const totalBots = bots.length;

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstBot = bots.at(0);
    setDepositValue(firstBot ? normalizeNumberValue(firstBot.deposit.amount) : '');
    setLeverageValue(firstBot ? normalizeNumberValue(firstBot.deposit.leverage) : '');
    setDepositEnabled(true);
    setLeverageEnabled(true);
    setError(null);
    setIsRunning(false);
    setProcessedCount(0);
    setResult(null);
  }, [open, bots]);

  const percent = useMemo(() => buildPercent(processedCount, totalBots), [processedCount, totalBots]);

  const progressStatus = useMemo(() => resolveProgressStatus(isRunning, result), [isRunning, result]);

  const hasFailures = result ? result.failed.length > 0 : false;
  const isCompleted = !isRunning && Boolean(result);

  const handleCancel = () => {
    if (isRunning) {
      return;
    }
    onClose();
  };

  const resolveOverrides = (): BotUpdateOverrides | null => {
    if (!(depositEnabled || leverageEnabled)) {
      setError('Выберите хотя бы один параметр для изменения.');
      return null;
    }

    const overrides: BotUpdateOverrides = {};

    if (depositEnabled) {
      const amount = parseNumericInput(depositValue);
      if (amount === null || amount <= 0) {
        setError('Введите корректный депозит.');
        return null;
      }
      overrides.depositAmount = amount;
    }

    if (leverageEnabled) {
      const leverage = parseNumericInput(leverageValue);
      if (leverage === null || leverage <= 0) {
        setError('Введите корректное плечо.');
        return null;
      }
      overrides.depositLeverage = leverage;
    }

    setError(null);
    return overrides;
  };

  const handleConfirm = async () => {
    if (isRunning || totalBots === 0) {
      return;
    }

    const overrides = resolveOverrides();
    if (!overrides) {
      return;
    }

    setIsRunning(true);
    setResult(null);
    setProcessedCount(0);

    const nextResult: BulkActionResult = {
      succeeded: [],
      failed: [],
    };

    let processed = 0;

    for (const bot of bots) {
      try {
        const payload = buildBotUpdatePayload(bot, overrides);
        // eslint-disable-next-line no-await-in-loop -- последовательная обработка важна для отображения прогресса
        await updateBot(payload);
        nextResult.succeeded.push(bot.id);
      } catch (updateError) {
        nextResult.failed.push({
          botId: bot.id,
          botName: bot.name,
          message: pickErrorMessage(updateError),
        });
      } finally {
        processed += 1;
        setProcessedCount(processed);
      }
    }

    setIsRunning(false);
    setProcessedCount(totalBots);
    setResult(nextResult);

    if (onCompleted) {
      onCompleted(nextResult);
    }
  };

  const confirmButtonDisabled = isRunning || (!isCompleted && totalBots === 0);
  const progressLabel = DEFAULT_PROGRESS_LABEL;

  return (
    <Modal
      open={open}
      title="Массовое редактирование ботов"
      onCancel={handleCancel}
      maskClosable={!isRunning}
      closable={!isRunning}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={isRunning}>
          Отменить
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={isCompleted ? onClose : handleConfirm}
          disabled={confirmButtonDisabled}
          loading={isRunning}
        >
          {isCompleted ? 'Закрыть' : 'Применить'}
        </Button>,
      ]}
    >
      <Paragraph>Единообразно обновим депозит и плечо всех выбранных ботов.</Paragraph>

      <div className="form-field">
        <Checkbox
          checked={depositEnabled}
          disabled={isRunning}
          onChange={(event) => {
            setDepositEnabled(event.target.checked);
            setError(null);
          }}
        >
          Изменить депозит
        </Checkbox>
        <label className="form-label" htmlFor="bulk-edit-deposit-amount">
          Новый депозит
        </label>
        <Input
          id="bulk-edit-deposit-amount"
          className="input"
          type="text"
          inputMode="decimal"
          value={depositValue}
          onChange={(event) => {
            setDepositValue(event.target.value);
            setError(null);
          }}
          disabled={!depositEnabled || isRunning}
          placeholder="Например, 150"
          style={{ marginTop: 8 }}
        />
      </div>

      <div className="form-field">
        <Checkbox
          checked={leverageEnabled}
          disabled={isRunning}
          onChange={(event) => {
            setLeverageEnabled(event.target.checked);
            setError(null);
          }}
        >
          Изменить плечо
        </Checkbox>
        <label className="form-label" htmlFor="bulk-edit-deposit-leverage">
          Новое плечо
        </label>
        <Input
          id="bulk-edit-deposit-leverage"
          className="input"
          type="text"
          inputMode="decimal"
          value={leverageValue}
          onChange={(event) => {
            setLeverageValue(event.target.value);
            setError(null);
          }}
          disabled={!leverageEnabled || isRunning}
          placeholder="Например, 5"
          style={{ marginTop: 8 }}
        />
      </div>

      {error && (
        <div className="form-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          {progressLabel}: {processedCount} из {totalBots}
        </Text>
        <Progress percent={percent} status={progressStatus} style={{ marginTop: 8 }} />
      </div>

      <div style={{ marginTop: 16 }}>
        {isRunning && <Text>Обновляем параметры...</Text>}
        {isCompleted && !hasFailures && <Alert type="success" message="Параметры успешно обновлены." showIcon />}
        {isCompleted && hasFailures && (
          <Alert
            type="error"
            message="Не удалось обновить часть ботов."
            description={
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {result?.failed.map((entry) => (
                  <li key={entry.botId}>
                    <Text>
                      {entry.botName} — {entry.message}
                    </Text>
                  </li>
                ))}
              </ul>
            }
            showIcon
          />
        )}
      </div>
    </Modal>
  );
};

export default BulkEditBotsModal;
