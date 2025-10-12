import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BotStrategy,
  buildBacktestPayload,
  composeSymbol,
  fetchBotStrategy,
  postBacktest,
  resolveQuoteCurrency,
  type SymbolDescriptor,
} from '../api/backtestRunner';
import { useImportedBots } from '../context/ImportedBotsContext';
import { readMultiCurrencyAssetList, writeMultiCurrencyAssetList } from '../storage/backtestPreferences';
import type { BotSummary } from '../types/bots';

export type BacktestVariant = 'single' | 'multiCurrency';

interface FormErrors {
  nameTemplate?: string;
  periodFrom?: string;
  periodTo?: string;
  makerCommission?: string;
  takerCommission?: string;
  assetList?: string;
}

interface BacktestFormState {
  nameTemplate: string;
  periodFrom: string;
  periodTo: string;
  makerCommission: string;
  takerCommission: string;
  isPublic: boolean;
  includeWicks: boolean;
  assetList: string;
}

interface BacktestLaunchPayload {
  bots: BotSummary[];
  variant: BacktestVariant;
  nameTemplate: string;
  periodFrom: string;
  periodTo: string;
  makerCommission: number;
  takerCommission: number;
  isPublic: boolean;
  includeWicks: boolean;
  assetList: string[];
}

interface BacktestModalProps {
  variant: BacktestVariant;
  selectedBots: BotSummary[];
  onClose: () => void;
}

interface LogEntry {
  id: string;
  node: ReactNode;
}

const variantLabels: Record<BacktestVariant, string> = {
  single: 'Бэктест',
  multiCurrency: 'Мультивалютный бэктест',
};

const defaultFormState: BacktestFormState = {
  nameTemplate: '{bot_name} {currency}',
  periodFrom: '',
  periodTo: '',
  makerCommission: '0.02',
  takerCommission: '0.055',
  isPublic: false,
  includeWicks: true,
  assetList: '',
};

const MIN_BACKTEST_DELAY_MS = 31_000;

const retainDigits = (value: string) => value.replace(/[^0-9.,]/g, '');

const parseCommission = (value: string): number => {
  const normalised = value.replace(',', '.');
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseAssetList = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toUpperCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const normalizeDateInput = (value: string): { year: number; month: number; day: number } => {
  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error('Некорректный формат даты.');
  }
  return { year, month, day };
};

const toIsoRange = (from: string, to: string): { startISO: string; endISO: string } => {
  const fromParts = normalizeDateInput(from);
  const toParts = normalizeDateInput(to);

  const startDate = new Date(Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(toParts.year, toParts.month - 1, toParts.day, 23, 59, 59, 999));

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Не удалось преобразовать даты в период.');
  }

  return { startISO: startDate.toISOString(), endISO: endDate.toISOString() };
};

const toDateInputValue = (date: Date): string => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const adjusted = new Date(date.getTime() - tzOffset);
  return adjusted.toISOString().slice(0, 10);
};

const subtractMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDay));
  return result;
};

const periodPresets = [
  { label: '1 месяц', months: 1 },
  { label: '3 месяца', months: 3 },
  { label: '6 месяцев', months: 6 },
  { label: '1 год', months: 12 },
];

const descriptorFromPair = (pair: BotStrategy['pair']): SymbolDescriptor | null => {
  if (!pair?.from || !pair.to) {
    return null;
  }
  const base = pair.from.trim().toUpperCase();
  const quote = pair.to.trim().toUpperCase();
  if (!base || !quote) {
    return null;
  }
  const pairCode = pair.symbol ? pair.symbol.trim().toUpperCase() : `${base}${quote}`;
  return {
    base,
    quote,
    display: `${base}/${quote}`,
    pairCode,
  };
};

const descriptorFromSymbol = (symbol: string | null | undefined): SymbolDescriptor | null => {
  if (!symbol) {
    return null;
  }
  const trimmed = symbol.trim();
  if (!trimmed.includes('/')) {
    return null;
  }
  const [base, quote] = trimmed.split('/').map((part) => part.trim().toUpperCase());
  if (!base || !quote) {
    return null;
  }
  return {
    base,
    quote,
    display: `${base}/${quote}`,
    pairCode: `${base}${quote}`,
  };
};

const extractExistingSymbol = (strategy: BotStrategy): SymbolDescriptor | null => {
  const fromPair = descriptorFromPair(strategy.pair ?? null);
  if (fromPair) {
    return fromPair;
  }

  const direct = descriptorFromSymbol(strategy.symbol ?? null);
  if (direct) {
    return direct;
  }

  if (Array.isArray(strategy.symbols)) {
    for (const candidate of strategy.symbols) {
      const descriptor = descriptorFromSymbol(candidate);
      if (descriptor) {
        return descriptor;
      }
    }
  }

  return null;
};

const applyNameTemplate = (template: string, botName: string, currency: string): string => {
  return template
    .replace(/\{bot_name\}/gi, botName)
    .replace(/\{currency\}/gi, currency)
    .replace(/\{asset\}/gi, currency);
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const BacktestModal = ({ variant, selectedBots, onClose }: BacktestModalProps) => {
  const [formState, setFormState] = useState<BacktestFormState>(() => ({
    ...defaultFormState,
    assetList: readMultiCurrencyAssetList(),
  }));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const isActiveRef = useRef(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const initialTitleRef = useRef<string | null>(null);
  const { getStrategyById } = useImportedBots();

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Reset form on variant change to avoid leftover fields between different actions.
    const storedAssetList = variant === 'multiCurrency' ? readMultiCurrencyAssetList() : '';
    setFormState((prev) => ({
      ...defaultFormState,
      nameTemplate: prev.nameTemplate || defaultFormState.nameTemplate,
      assetList: storedAssetList,
    }));
    setFormErrors({});
    setLogs([]);
    setRunError(null);
    setIsRunning(false);
    setIsCompleted(false);
    setProgress(0);
  }, [variant]);

  const title = useMemo(() => variantLabels[variant], [variant]);
  const handleCancel = () => {
    if (isRunning) {
      isActiveRef.current = false;
    }
    onClose();
  };

  useEffect(() => {
    if (initialTitleRef.current === null) {
      initialTitleRef.current = document.title;
    }
  }, []);

  useEffect(() => {
    if (initialTitleRef.current === null) {
      initialTitleRef.current = document.title;
    }

    if ((isRunning || isCompleted) && progress > 0) {
      document.title = `(${progress}%) ${initialTitleRef.current}`;
    } else if (initialTitleRef.current) {
      document.title = initialTitleRef.current;
    }
  }, [isRunning, isCompleted, progress]);

  useEffect(() => {
    return () => {
      if (initialTitleRef.current) {
        document.title = initialTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, []);

  const appendLog = useCallback((node: ReactNode, id?: string): string | null => {
    if (!isActiveRef.current) {
      return null;
    }
    const entryId = id ?? `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setLogs((prev) => [...prev, { id: entryId, node }]);
    return entryId;
  }, []);

  const replaceLog = useCallback((id: string, node: ReactNode) => {
    if (!isActiveRef.current) {
      return;
    }
    setLogs((prev) => {
      const filtered = prev.filter((entry) => entry.id !== id);
      return [...filtered, { id, node }];
    });
  }, []);

  const handlePresetClick = (months: number) => {
    const now = new Date();
    const periodTo = toDateInputValue(now);
    const periodFromDate = subtractMonths(now, months);
    const periodFrom = toDateInputValue(periodFromDate);
    setFormState((prev) => ({
      ...prev,
      periodFrom,
      periodTo,
    }));
    setFormErrors((prev) => ({
      ...prev,
      periodFrom: undefined,
      periodTo: undefined,
    }));
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'makerCommission' || name === 'takerCommission') {
      setFormState((prev) => ({
        ...prev,
        [name]: retainDigits(value),
      }));
      return;
    }
    if (name === 'assetList') {
      writeMultiCurrencyAssetList(value);
    }

    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const validateForm = useCallback(
    (state: BacktestFormState): FormErrors => {
      const errors: FormErrors = {};
      if (state.nameTemplate.trim().length === 0) {
        errors.nameTemplate = 'Введите название бэктеста';
      }
      if (state.periodFrom.trim().length === 0) {
        errors.periodFrom = 'Укажите дату начала';
      }
      if (state.periodTo.trim().length === 0) {
        errors.periodTo = 'Укажите дату окончания';
      }
      if (state.periodFrom && state.periodTo && state.periodFrom > state.periodTo) {
        errors.periodTo = 'Дата окончания должна быть позже даты начала';
      }

      const maker = parseCommission(state.makerCommission);
      if (Number.isNaN(maker) || maker < 0) {
        errors.makerCommission = 'Некорректное значение комиссии мейкера';
      }

      const taker = parseCommission(state.takerCommission);
      if (Number.isNaN(taker) || taker < 0) {
        errors.takerCommission = 'Некорректное значение комиссии тейкера';
      }

      if (variant === 'multiCurrency') {
        const items = parseAssetList(state.assetList);
        if (items.length === 0) {
          errors.assetList = 'Добавьте хотя бы одну валюту';
        }
      }

      return errors;
    },
    [variant],
  );

  const buildPayload = useCallback(
    (state: BacktestFormState): BacktestLaunchPayload => ({
      bots: selectedBots.map((bot) => ({ ...bot })),
      variant,
      nameTemplate: state.nameTemplate.trim(),
      periodFrom: state.periodFrom,
      periodTo: state.periodTo,
      makerCommission: parseCommission(state.makerCommission),
      takerCommission: parseCommission(state.takerCommission),
      isPublic: state.isPublic,
      includeWicks: state.includeWicks,
      assetList: variant === 'multiCurrency' ? parseAssetList(state.assetList) : [],
    }),
    [selectedBots, variant],
  );

  const runBacktests = useCallback(
    async (payload: BacktestLaunchPayload) => {
      setRunError(null);
      setIsRunning(true);
      setIsCompleted(false);
      setLogs([]);
      setProgress(0);

      try {
        const { startISO, endISO } = toIsoRange(payload.periodFrom, payload.periodTo);

        const assets = payload.variant === 'multiCurrency' ? payload.assetList : [];
        const plannedTotal =
          payload.variant === 'multiCurrency' ? payload.bots.length * assets.length : payload.bots.length;

        let completed = 0;
        let _launchedRequests = 0;

        const updateProgress = () => {
          if (!isActiveRef.current) {
            return;
          }
          if (plannedTotal === 0) {
            setProgress(100);
            return;
          }
          const safeCompleted = Math.min(completed, plannedTotal);
          setProgress(Math.round((safeCompleted / plannedTotal) * 100));
        };

        if (payload.variant === 'multiCurrency' && assets.length === 0) {
          appendLog('Список валют пуст — запуск невозможен.');
          updateProgress();
          if (isActiveRef.current) {
            setIsCompleted(true);
          }
          return;
        }

        for (const bot of payload.bots) {
          if (!isActiveRef.current) {
            return;
          }

          let strategy: BotStrategy | null = getStrategyById(bot.id);

          if (strategy) {
            appendLog(`Используем локальную конфигурацию для ${bot.name}.`);
          } else {
            appendLog(`Получаем стратегию бота ${bot.name} (ID: ${bot.id})...`);
            try {
              strategy = await fetchBotStrategy(bot.id);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              appendLog(`❌ Ошибка загрузки стратегии ${bot.name}: ${message}`);
              if (payload.variant === 'single') {
                completed += 1;
              } else {
                completed += assets.length;
              }
              updateProgress();
              continue;
            }
          }

          if (!strategy) {
            appendLog(`❌ Стратегия ${bot.name} недоступна.`);
            if (payload.variant === 'single') {
              completed += 1;
            } else {
              completed += assets.length;
            }
            updateProgress();
            continue;
          }

          if (payload.variant === 'multiCurrency') {
            const quote = resolveQuoteCurrency(strategy);
            if (!quote) {
              appendLog(`Не удалось определить котируемую валюту для ${bot.name}.`);
              completed += assets.length;
              updateProgress();
              continue;
            }

            for (const asset of assets) {
              if (!isActiveRef.current) {
                return;
              }

              let descriptor: SymbolDescriptor;
              try {
                descriptor = composeSymbol(asset, quote);
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                appendLog(`Пропуск ${asset} для ${bot.name}: ${message}`);
                completed += 1;
                updateProgress();
                continue;
              }

              const assetLabel = descriptor.display;
              const currencyLabel = descriptor.base;
              const backtestName = applyNameTemplate(payload.nameTemplate, bot.name, currencyLabel);
              const pendingId = appendLog(
                <>
                  ⏳ «{backtestName}» — {assetLabel}
                </>,
                `pending-${bot.id}-${descriptor.pairCode ?? descriptor.base}-${Date.now()}-${Math.random()
                  .toString(16)
                  .slice(2)}`,
              );

              try {
                const body = buildBacktestPayload(strategy, {
                  name: backtestName,
                  makerCommission: payload.makerCommission,
                  takerCommission: payload.takerCommission,
                  includeWicks: payload.includeWicks,
                  isPublic: payload.isPublic,
                  periodStartISO: startISO,
                  periodEndISO: endISO,
                  overrideSymbol: descriptor,
                });
                const response = await postBacktest(body);
                const backtestId = typeof response.id === 'number' ? response.id : '—';
                const backtestUrl =
                  typeof response.id === 'number' ? `https://veles.finance/cabinet/backtests/${response.id}` : null;
                const successNode = backtestUrl ? (
                  <>
                    ✅ «{backtestName}» в очереди (ID:{' '}
                    <a href={backtestUrl} target="_blank" rel="noreferrer noopener">
                      {backtestId}
                    </a>
                    )
                  </>
                ) : (
                  `✅ «${backtestName}» в очереди (ID: ${backtestId})`
                );
                if (pendingId) {
                  replaceLog(pendingId, successNode);
                } else {
                  appendLog(successNode);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const errorNode = `❌ Ошибка запуска «${backtestName}»: ${message}`;
                if (pendingId) {
                  replaceLog(pendingId, errorNode);
                } else {
                  appendLog(errorNode);
                }
                await wait(MIN_BACKTEST_DELAY_MS);
                if (!isActiveRef.current) {
                  return;
                }
              } finally {
                _launchedRequests += 1;
                completed += 1;
                updateProgress();
              }
              await wait(MIN_BACKTEST_DELAY_MS);
              if (!isActiveRef.current) {
                return;
              }
            }
          } else {
            const descriptor = extractExistingSymbol(strategy);
            if (!descriptor) {
              appendLog(`Не удалось определить текущий инструмент для ${bot.name}.`);
              completed += 1;
              updateProgress();
              continue;
            }

            const assetLabel = descriptor.display;
            const currencyLabel = descriptor.base;
            const backtestName = applyNameTemplate(payload.nameTemplate, bot.name, currencyLabel);
            const logId = appendLog(
              <>
                ⏳ «{backtestName}» — {assetLabel}
              </>,
              `pending-${bot.id}-${descriptor.pairCode ?? descriptor.base}-${Date.now()}-${Math.random()
                .toString(16)
                .slice(2)}`,
            );
            try {
              const body = buildBacktestPayload(strategy, {
                name: backtestName,
                makerCommission: payload.makerCommission,
                takerCommission: payload.takerCommission,
                includeWicks: payload.includeWicks,
                isPublic: payload.isPublic,
                periodStartISO: startISO,
                periodEndISO: endISO,
                overrideSymbol: descriptor,
              });
              const response = await postBacktest(body);
              const backtestId = typeof response.id === 'number' ? response.id : '—';
              const backtestUrl =
                typeof response.id === 'number' ? `https://veles.finance/cabinet/backtests/${response.id}` : null;
              if (logId) {
                replaceLog(
                  logId,
                  backtestUrl ? (
                    <>
                      ✅ «{backtestName}» в очереди (ID:{' '}
                      <a href={backtestUrl} target="_blank" rel="noreferrer noopener">
                        {backtestId}
                      </a>
                      )
                    </>
                  ) : (
                    `✅ «${backtestName}» в очереди (ID: ${backtestId})`
                  ),
                );
              } else {
                appendLog(
                  backtestUrl ? (
                    <>
                      ✅ «{backtestName}» в очереди (ID:{' '}
                      <a href={backtestUrl} target="_blank" rel="noreferrer noopener">
                        {backtestId}
                      </a>
                      )
                    </>
                  ) : (
                    `✅ «${backtestName}» в очереди (ID: ${backtestId})`
                  ),
                );
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (logId) {
                replaceLog(logId, `❌ Ошибка запуска «${backtestName}»: ${message}`);
              } else {
                appendLog(`❌ Ошибка запуска «${backtestName}»: ${message}`);
              }
              await wait(MIN_BACKTEST_DELAY_MS);
              if (!isActiveRef.current) {
                return;
              }
            } finally {
              _launchedRequests += 1;
              completed += 1;
              updateProgress();
            }
            await wait(MIN_BACKTEST_DELAY_MS);
            if (!isActiveRef.current) {
              return;
            }
          }
        }

        if (plannedTotal === 0) {
          updateProgress();
        }

        if (completed === 0) {
          appendLog('Нет задач для запуска.');
        }

        if (isActiveRef.current) {
          setIsCompleted(true);
        }
      } catch (error) {
        if (!isActiveRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка запуска';
        setRunError(message);
        appendLog(`❌ Ошибка: ${message}`);
      } finally {
        if (isActiveRef.current) {
          setIsRunning(false);
        }
      }
    },
    [appendLog, getStrategyById, replaceLog],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateForm(formState);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = buildPayload(formState);
    await runBacktests(payload);
  };

  const placeholderExample = useMemo(() => `Примеры: {bot_name}, {currency}`, []);

  return (
    <div className="modal">
      <div className="modal__overlay" role="presentation" />
      <div className="modal__content" role="dialog" aria-modal="true" aria-labelledby="backtest-modal-title">
        <header className="modal__header">
          <h2 className="modal__title" id="backtest-modal-title">
            {title}
          </h2>
          <p className="modal__subtitle">Выбрано ботов: {selectedBots.length}</p>
        </header>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="backtest-name">
              Название бэктеста
            </label>
            <input
              id="backtest-name"
              name="nameTemplate"
              type="text"
              className={`input ${formErrors.nameTemplate ? 'input--error' : ''}`}
              value={formState.nameTemplate}
              onChange={handleTextChange}
              placeholder="Например: {bot_name} backtest"
              disabled={isRunning}
            />
            <span className="form-hint">Можно использовать плейсхолдеры {placeholderExample}</span>
            {formErrors.nameTemplate && <span className="form-error">{formErrors.nameTemplate}</span>}
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="backtest-period-from">
                Дата начала
              </label>
              <input
                id="backtest-period-from"
                name="periodFrom"
                type="date"
                className={`input ${formErrors.periodFrom ? 'input--error' : ''}`}
                value={formState.periodFrom}
                onChange={handleTextChange}
                disabled={isRunning}
              />
              {formErrors.periodFrom && <span className="form-error">{formErrors.periodFrom}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="backtest-period-to">
                Дата окончания
              </label>
              <input
                id="backtest-period-to"
                name="periodTo"
                type="date"
                className={`input ${formErrors.periodTo ? 'input--error' : ''}`}
                value={formState.periodTo}
                onChange={handleTextChange}
                disabled={isRunning}
              />
              {formErrors.periodTo && <span className="form-error">{formErrors.periodTo}</span>}
            </div>
          </div>

          <div className="form-presets">
            <span className="form-presets__label">Быстрый период:</span>
            {periodPresets.map((preset) => (
              <button
                key={preset.months}
                type="button"
                className="form-preset-button"
                onClick={() => handlePresetClick(preset.months)}
                disabled={isRunning}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="maker-commission">
                Комиссия мейкера
              </label>
              <input
                id="maker-commission"
                name="makerCommission"
                type="text"
                inputMode="decimal"
                className={`input ${formErrors.makerCommission ? 'input--error' : ''}`}
                value={formState.makerCommission}
                onChange={handleTextChange}
                disabled={isRunning}
              />
              {formErrors.makerCommission && <span className="form-error">{formErrors.makerCommission}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="taker-commission">
                Комиссия тейкера
              </label>
              <input
                id="taker-commission"
                name="takerCommission"
                type="text"
                inputMode="decimal"
                className={`input ${formErrors.takerCommission ? 'input--error' : ''}`}
                value={formState.takerCommission}
                onChange={handleTextChange}
                disabled={isRunning}
              />
              {formErrors.takerCommission && <span className="form-error">{formErrors.takerCommission}</span>}
            </div>
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="isPublic"
                checked={formState.isPublic}
                onChange={handleCheckboxChange}
                disabled={isRunning}
              />
              <span>Публичный бэктест</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="includeWicks"
                checked={formState.includeWicks}
                onChange={handleCheckboxChange}
                disabled={isRunning}
              />
              <span>Учитывать тени свечей</span>
            </label>
          </div>

          {variant === 'multiCurrency' && (
            <div className="form-field">
              <label className="form-label" htmlFor="asset-list">
                Список валют
              </label>
              <textarea
                id="asset-list"
                name="assetList"
                className={`textarea ${formErrors.assetList ? 'textarea--error' : ''}`}
                rows={3}
                placeholder="Например: BTC, ETH, SOL"
                value={formState.assetList}
                onChange={handleTextChange}
                disabled={isRunning}
              />
              <span className="form-hint">Разделитель — пробел, запятая или перенос строки</span>
              {formErrors.assetList && <span className="form-error">{formErrors.assetList}</span>}
            </div>
          )}

          {logs.length > 0 && (
            <div className="run-log">
              <div className="run-log__progress">
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-bar__label">{progress}%</span>
              </div>
              <div className="run-log__messages" role="log" aria-live="polite" ref={logContainerRef}>
                {logs.map((entry) => (
                  <div key={entry.id} className="run-log__entry">
                    {entry.node}
                  </div>
                ))}
              </div>
            </div>
          )}

          {runError && <div className="banner banner--warning">{runError}</div>}

          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={handleCancel}>
              {isRunning ? 'Отменить' : isCompleted ? 'Закрыть' : 'Отмена'}
            </button>
            <button type="submit" className="button" disabled={isRunning}>
              {isRunning ? 'Запускаем…' : 'Запустить'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default BacktestModal;
