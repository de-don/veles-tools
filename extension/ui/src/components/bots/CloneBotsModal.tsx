import { Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { composeSymbol } from '../../api/backtestRunner';
import { createBot } from '../../api/bots';
import type { ApiKey } from '../../types/apiKeys';
import type { TradingBot } from '../../types/bots';
import { parseAssetList } from '../../lib/assetList';
import { applyBotNameTemplate } from '../../lib/nameTemplate';
import { parseNumericInput } from '../../lib/numericInput';
import { buildBotClonePayload } from '../../lib/botClonePayload';

interface CloneBotsModalProps {
  open: boolean;
  bots: TradingBot[];
  apiKeys: ApiKey[];
  onClose: () => void;
  onCompleted?: (summary: { succeeded: number; failed: number }) => void;
}

type LogLevel = 'info' | 'success' | 'error';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
}

const DEFAULT_TEMPLATE = '{bot_name} {currency}';

const createLogId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeNumberValue = (value: number | string | null | undefined): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return '';
};

const normalizeMarginType = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toUpperCase();
};

const resolveQuoteCurrency = (bot: TradingBot | undefined): string | null => {
  if (!bot) {
    return null;
  }

  const primarySymbol = Array.isArray(bot.symbols) ? bot.symbols[0] : null;
  if (typeof primarySymbol === 'string' && primarySymbol.includes('/')) {
    const [_, quote] = primarySymbol.split('/');
    if (quote && quote.trim().length > 0) {
      return quote.trim().toUpperCase();
    }
  }
  const profitCurrency = bot.profit?.currency;
  if (typeof profitCurrency === 'string' && profitCurrency.trim().length > 0) {
    return profitCurrency.trim().toUpperCase();
  }
  return null;
};

const CloneBotsModal = ({ open, bots, apiKeys, onClose, onCompleted }: CloneBotsModalProps) => {
  const [apiKeyId, setApiKeyId] = useState<number | null>(null);
  const [nameTemplate, setNameTemplate] = useState(DEFAULT_TEMPLATE);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLeverage, setDepositLeverage] = useState('');
  const [assetList, setAssetList] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const totalBots = bots.length;

  const defaultDepositCurrency = useMemo(() => resolveQuoteCurrency(bots[0]), [bots]);

  const defaultMarginType = useMemo(() => normalizeMarginType(bots[0]?.deposit?.marginType ?? null), [bots]);

  const percent = useMemo(() => {
    if (!totalBots) {
      return 0;
    }
    const parsedAssets = parseAssetList(assetList);
    const totalTasks = parsedAssets.length * totalBots;
    if (totalTasks === 0) {
      return 0;
    }
    return Math.min(100, Math.round((processed / totalTasks) * 100));
  }, [assetList, processed, totalBots]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstApiKey = apiKeys[0]?.id ?? null;
    setApiKeyId((prev) => prev ?? firstApiKey);
    setNameTemplate(DEFAULT_TEMPLATE);
    setDepositAmount(normalizeNumberValue(bots[0]?.deposit?.amount ?? null));
    setDepositLeverage(normalizeNumberValue(bots[0]?.deposit?.leverage ?? null));
    setAssetList('');
    setLogs([]);
    setIsRunning(false);
    setProcessed(0);
    setError(null);
  }, [open, bots, apiKeys]);

  const appendLog = (level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, { id: createLogId(), level, message }]);
  };

  const handleCancel = () => {
    if (isRunning) {
      return;
    }
    onClose();
  };

  const runCloning = async () => {
    if (isRunning) {
      return;
    }

    const trimmedTemplate = nameTemplate.trim();
    if (!trimmedTemplate) {
      setError('Введите шаблон названия.');
      return;
    }

    if (!apiKeyId) {
      setError('Выберите API-ключ.');
      return;
    }

    const amount = parseNumericInput(depositAmount);
    if (amount === null || amount <= 0) {
      setError('Введите корректный депозит.');
      return;
    }

    const leverage = parseNumericInput(depositLeverage);
    if (leverage === null || leverage <= 0) {
      setError('Введите корректное плечо.');
      return;
    }

    const assets = parseAssetList(assetList);
    if (assets.length === 0) {
      setError('Добавьте хотя бы одну монету.');
      return;
    }

    if (totalBots === 0) {
      setError('Не выбрано ни одного бота для клонирования.');
      return;
    }

    setError(null);
    setLogs([]);
    setIsRunning(true);
    setProcessed(0);

    let processedOperations = 0;
    let succeeded = 0;
    let failed = 0;

    const totalTasks = assets.length * totalBots;

    const reportProgress = () => {
      processedOperations += 1;
      setProcessed(processedOperations);
    };

    for (const bot of bots) {
      const quote = resolveQuoteCurrency(bot);
      if (!quote) {
        appendLog('error', `Бот ${bot.name}: не удалось определить котируемую валюту.`);
        failed += assets.length;
        processedOperations += assets.length;
        setProcessed(processedOperations);
        continue;
      }

      for (const asset of assets) {
        const descriptor = (() => {
          try {
            return composeSymbol(asset, quote);
          } catch (composeError) {
            const message = composeError instanceof Error ? composeError.message : String(composeError);
            appendLog('error', `Пропуск ${asset} для ${bot.name}: ${message}`);
            failed += 1;
            reportProgress();
            return null;
          }
        })();

        if (!descriptor) {
          continue;
        }

        const botName = applyBotNameTemplate(trimmedTemplate, bot.name, descriptor.base);
        appendLog('info', `Создаём «${botName}» (${descriptor.display})...`);

        try {
          const payload = buildBotClonePayload(bot, descriptor, {
            apiKeyId,
            name: botName,
            depositAmount: amount,
            depositLeverage: leverage,
            marginType: defaultMarginType,
            depositCurrency: defaultDepositCurrency ?? quote,
            profitCurrency: bot.profit?.currency ?? quote,
          });

          const response = await createBot(payload);
          const botId = response.id ?? '—';
          appendLog('success', `✅ «${botName}» создан (ID: ${botId}).`);
          succeeded += 1;
        } catch (cloneError) {
          const message = cloneError instanceof Error ? cloneError.message : String(cloneError);
          appendLog('error', `❌ Ошибка создания «${botName}»: ${message}`);
          failed += 1;
        } finally {
          reportProgress();
        }
      }
    }

    setIsRunning(false);
    setProcessed(totalTasks);

    if (onCompleted) {
      onCompleted({ succeeded, failed });
    }
  };

  const totalAssets = useMemo(() => parseAssetList(assetList).length, [assetList]);
  const totalPlanned = totalBots * totalAssets;

  return (
    <Modal open={open} title="Клонировать ботов" footer={null} onCancel={handleCancel} maskClosable={!isRunning}>
      <div className="form-field">
        <label className="form-label" htmlFor="clone-bots-api-key">
          API-ключ
        </label>
        <Select<number>
          id="clone-bots-api-key"
          showSearch
          placeholder="Выберите API-ключ"
          value={apiKeyId ?? undefined}
          onChange={(value) => setApiKeyId(value)}
          optionFilterProp="label"
          disabled={isRunning || apiKeys.length === 0}
          options={apiKeys.map((key) => ({
            label: key.name ? `${key.name} (${key.exchange})` : `#${key.id}`,
            value: key.id,
          }))}
        />
      </div>

      <div className="form-field" style={{ marginTop: 16 }}>
        <label className="form-label" htmlFor="clone-bots-name-template">
          Шаблон названия
        </label>
        <Input
          id="clone-bots-name-template"
          value={nameTemplate}
          onChange={(event) => setNameTemplate(event.target.value)}
          disabled={isRunning}
          placeholder="Например {bot_name} {currency}"
        />
        <span className="form-hint">Доступные плейсхолдеры: {'{bot_name}'}, {'{currency}'}</span>
      </div>

      <div
        className="form-grid"
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          marginTop: 16,
        }}
      >
        <div className="form-field">
          <label className="form-label" htmlFor="clone-bots-deposit">
            Депозит
          </label>
          <Input
            id="clone-bots-deposit"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            disabled={isRunning}
            placeholder="Например 1000"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="clone-bots-leverage">
            Плечо
          </label>
          <Input
            id="clone-bots-leverage"
            value={depositLeverage}
            onChange={(event) => setDepositLeverage(event.target.value)}
            disabled={isRunning}
            placeholder="Например 10"
          />
        </div>
      </div>

      <div className="form-field" style={{ marginTop: 16 }}>
        <label className="form-label" htmlFor="clone-bots-assets">
          Монеты
        </label>
        <textarea
          id="clone-bots-assets"
          className="textarea"
          rows={3}
          value={assetList}
          onChange={(event) => setAssetList(event.target.value)}
          disabled={isRunning}
          placeholder="Например: BTC, ETH, SOL"
        />
        <span className="form-hint">Разделитель — пробел, запятая или перенос строки</span>
      </div>

      {error && (
        <div className="form-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {isRunning && (
        <div className="run-log" style={{ marginTop: 16 }}>
          <div className="run-log__progress">
            <span>
              Выполнено {processed} из {totalPlanned}
            </span>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div
          style={{
            marginTop: 16,
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #1f2937',
            borderRadius: 6,
            padding: 12,
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {logs.map((entry) => (
              <li
                key={entry.id}
                style={{
                  color: entry.level === 'error' ? '#f87171' : entry.level === 'success' ? '#34d399' : '#cbd5f5',
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 20,
        }}
      >
        <button type="button" className="button button--ghost" onClick={handleCancel} disabled={isRunning}>
          Отменить
        </button>
        <button
          type="button"
          className="button"
          onClick={runCloning}
          disabled={isRunning || totalPlanned === 0 || !apiKeyId}
        >
          {isRunning ? 'Создаём…' : `Создать (${totalPlanned})`}
        </button>
      </div>
    </Modal>
  );
};

export default CloneBotsModal;
