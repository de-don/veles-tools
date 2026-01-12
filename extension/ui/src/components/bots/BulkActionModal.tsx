import { Alert, Button, Checkbox, Flex, Modal, Progress, Space, Typography } from 'antd';
import type { ButtonProps } from 'antd/es/button';
import type { ProgressProps } from 'antd/es/progress';
import { useEffect, useMemo, useState } from 'react';
import type { BotIdentifier, TradingBot } from '../../types/bots';

const { Paragraph, Text } = Typography;

export interface BulkActionErrorEntry {
  botId: BotIdentifier;
  botName: string;
  message: string;
}

export interface BulkActionResult {
  succeeded: BotIdentifier[];
  failed: BulkActionErrorEntry[];
}

export interface BulkActionCopy {
  title: string;
  description?: string;
  checkboxLabel: string;
  confirmLabel: string;
  runningMessage: string;
  successMessage: string;
  failureMessage: string;
  progressLabel?: string;
}

interface BulkActionModalProps {
  open: boolean;
  bots: TradingBot[];
  copy: BulkActionCopy;
  runAction: (bot: TradingBot) => Promise<void>;
  onClose: () => void;
  onCompleted?: (result: BulkActionResult) => void;
  confirmButtonType?: ButtonProps['type'];
  confirmButtonDanger?: boolean;
}

const DEFAULT_PROGRESS_LABEL = 'Обработано';

const pickErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const buildProgressStatus = (isRunning: boolean, result: BulkActionResult | null): ProgressProps['status'] => {
  if (isRunning) {
    return 'active';
  }
  if (!result) {
    return 'normal';
  }
  return result.failed.length > 0 ? 'exception' : 'success';
};

const buildPercent = (processed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Math.round((processed / total) * 100);
};

const trimMessage = (message: string): string => {
  const normalized = message.trim();
  return normalized.length > 0 ? normalized : 'Неизвестная ошибка';
};

const BulkActionModal = ({
  open,
  bots,
  copy,
  runAction,
  onClose,
  onCompleted,
  confirmButtonType = 'primary',
  confirmButtonDanger = false,
}: BulkActionModalProps) => {
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [result, setResult] = useState<BulkActionResult | null>(null);

  const totalBots = bots.length;

  useEffect(() => {
    if (!open) {
      setPolicyAccepted(false);
      setIsRunning(false);
      setProcessedCount(0);
      setResult(null);
      return;
    }

    setPolicyAccepted(false);
    setIsRunning(false);
    setProcessedCount(0);
    setResult(null);
  }, [open]);

  const percent = useMemo(() => buildPercent(processedCount, totalBots), [processedCount, totalBots]);

  const progressStatus = useMemo(() => buildProgressStatus(isRunning, result), [isRunning, result]);

  const handleCancel = () => {
    if (isRunning) {
      return;
    }
    onClose();
  };

  const handleConfirm = async () => {
    if (isRunning || totalBots === 0) {
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
        // eslint-disable-next-line no-await-in-loop -- последовательная обработка важна для отображения прогресса
        await runAction(bot);
        nextResult.succeeded.push(bot.id);
      } catch (error) {
        const message = trimMessage(pickErrorMessage(error));
        nextResult.failed.push({
          botId: bot.id,
          botName: bot.name,
          message,
        });
      } finally {
        processed += 1;
        setProcessedCount(processed);
      }
    }

    setIsRunning(false);
    setResult(nextResult);
    setPolicyAccepted(false);
    setProcessedCount(totalBots);

    if (onCompleted) {
      onCompleted(nextResult);
    }
  };

  const hasFailures = result ? result.failed.length > 0 : false;
  const isCompleted = !isRunning && Boolean(result);

  const confirmButtonDisabled = !isCompleted && (!policyAccepted || totalBots === 0);

  const progressLabel = copy.progressLabel ?? DEFAULT_PROGRESS_LABEL;

  return (
    <Modal
      open={open}
      title={copy.title}
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
          type={confirmButtonType}
          danger={confirmButtonDanger}
          onClick={isCompleted ? onClose : handleConfirm}
          disabled={confirmButtonDisabled}
          loading={isRunning}
        >
          {isCompleted ? 'Закрыть' : copy.confirmLabel}
        </Button>,
      ]}
    >
      {copy.description && <Paragraph>{copy.description}</Paragraph>}

      <Checkbox
        checked={policyAccepted}
        disabled={isRunning || totalBots === 0}
        onChange={(event) => {
          setPolicyAccepted(event.target.checked);
        }}
      >
        {copy.checkboxLabel}
      </Checkbox>

      <Space direction="vertical" size={8} className="modal-progress u-mt-16">
        <Text type="secondary">
          {progressLabel}: {processedCount} из {totalBots}
        </Text>
        <Progress percent={percent} status={progressStatus} />
      </Space>

      <Flex vertical className="u-mt-16">
        {isRunning && <Text>{copy.runningMessage}</Text>}
        {isCompleted && !hasFailures && <Alert type="success" message={copy.successMessage} showIcon />}
        {isCompleted && hasFailures && (
          <Alert
            type="error"
            message={copy.failureMessage}
            description={
              <ul className="alert-list">
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
      </Flex>
    </Modal>
  );
};

export default BulkActionModal;
