import { useCallback, useEffect, useMemo, useState } from 'react';
import BacktestModal, { type BacktestVariant } from '../components/BacktestModal';
import { fetchBotStrategy, type BotStrategy } from '../api/backtestRunner';
import { useImportedBots, type ImportedBotEntry } from '../context/ImportedBotsContext';
import type { BotSummary } from '../types/bots';

interface ImportBotsPageProps {
  extensionReady: boolean;
}

type SelectionMap = Map<string, BotSummary>;

type LogKind = 'info' | 'success' | 'error';

interface ImportLogEntry {
  id: string;
  message: string;
  kind: LogKind;
}

const buildLogEntryId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const inferenceAlgorithm = (strategy: BotStrategy): string => {
  if (typeof strategy.algorithm === 'string' && strategy.algorithm.trim().length > 0) {
    return strategy.algorithm.trim();
  }
  if (typeof strategy.settings?.type === 'string' && strategy.settings.type.trim().length > 0) {
    return strategy.settings.type.trim();
  }
  return '—';
};

const inferenceSymbols = (strategy: BotStrategy): string => {
  if (typeof strategy.symbol === 'string' && strategy.symbol.trim().length > 0) {
    return strategy.symbol.trim();
  }
  if (Array.isArray(strategy.symbols) && strategy.symbols.length > 0) {
    return strategy.symbols.join(', ');
  }
  if (strategy.pair?.from && strategy.pair?.to) {
    return `${strategy.pair.from}/${strategy.pair.to}`;
  }
  return '—';
};

const normalizeAliasCandidate = (candidate: string): string | null => {
  const trimmed = candidate.trim().replace(/["'\[\]]/g, '');
  if (!trimmed) {
    return null;
  }
  const withoutParams = trimmed.split(/[?#]/)[0];
  try {
    const url = new URL(withoutParams);
    const segments = url.pathname.split('/').filter(Boolean);
    const alias = segments.pop();
    if (!alias) {
      return null;
    }
    return alias;
  } catch {
    const segments = withoutParams.split('/').filter(Boolean);
    const alias = segments.pop() ?? withoutParams;
    const normalized = alias.trim();
    if (!normalized) {
      return null;
    }
    return normalized;
  }
};

const deduplicate = (items: string[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
};

const parseAliasInput = (raw: string): string[] => {
  if (!raw.trim()) {
    return [];
  }

  const trimmed = raw.trim();

  const tokens = trimmed
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const normalized = tokens
    .map(normalizeAliasCandidate)
    .filter((item): item is string => Boolean(item));

  return deduplicate(normalized);
};

const buildImportedEntry = (alias: string, strategy: BotStrategy): ImportedBotEntry => {
  const name = typeof strategy.name === 'string' && strategy.name.trim().length > 0 ? strategy.name.trim() : `Бот ${alias}`;
  const exchange = typeof strategy.exchange === 'string' && strategy.exchange.trim().length > 0 ? strategy.exchange.trim() : '—';
  const status = typeof strategy.status === 'string' && strategy.status.trim().length > 0 ? strategy.status.trim() : 'UNKNOWN';
  const substatus = typeof strategy.substatus === 'string' && strategy.substatus.trim().length > 0 ? strategy.substatus.trim() : null;
  const summary: BotSummary = {
    id: alias,
    name,
    exchange,
    algorithm: inferenceAlgorithm(strategy),
    status,
    substatus,
    origin: 'imported',
  };

  return {
    id: alias,
    alias,
    sourceUrl: `https://veles.finance/share/${alias}`,
    summary,
    strategy,
    savedAt: Date.now(),
  };
};

const ImportBotsPage = ({ extensionReady }: ImportBotsPageProps) => {
  const { bots: importedBots, upsertBots, removeBot, clearAll } = useImportedBots();

  const [inputValue, setInputValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [activeModal, setActiveModal] = useState<BacktestVariant | null>(null);
  const [selection, setSelection] = useState<SelectionMap>(new Map());

  const importedIds = useMemo(() => new Set(importedBots.map((entry) => entry.id)), [importedBots]);

  useEffect(() => {
    setSelection((prev) => {
      const next = new Map(prev);
      for (const key of Array.from(next.keys())) {
        if (!importedIds.has(key)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, [importedIds]);

  const selectedBotsList = useMemo(() => Array.from(selection.values()), [selection]);
  const totalSelected = selection.size;

  const appendLog = useCallback((message: string, kind: LogKind) => {
    setLogs((current) => [{ id: buildLogEntryId(kind), message, kind }, ...current]);
  }, []);

  const resetLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleSelection = useCallback((entry: ImportedBotEntry) => {
    const key = entry.id;
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, entry.summary);
      }
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback((checked: boolean) => {
    setSelection((prev) => {
      if (!checked) {
        return new Map();
      }
      const next = new Map<string, BotSummary>();
      for (const entry of importedBots) {
        next.set(entry.id, entry.summary);
      }
      return next;
    });
  }, [importedBots]);

  const handleImport = useCallback(async () => {
    resetLogs();
    if (!extensionReady) {
      appendLog('Расширение не активно — импорт невозможен.', 'error');
      return;
    }

    const aliases = parseAliasInput(inputValue);
    if (aliases.length === 0) {
      appendLog('Не удалось найти валидные ссылки или идентификаторы.', 'error');
      return;
    }

    setIsImporting(true);

    const importedEntries: ImportedBotEntry[] = [];

    for (const alias of aliases) {
      try {
        const strategy = await fetchBotStrategy(alias);
        const entry = buildImportedEntry(alias, strategy);
        importedEntries.push(entry);
        appendLog(`Импортирован бот «${entry.summary.name}» (${alias}).`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendLog(`Ошибка при импорте ${alias}: ${message}`, 'error');
      }
    }

    if (importedEntries.length > 0) {
      upsertBots(importedEntries);
    }

    setIsImporting(false);
  }, [appendLog, extensionReady, inputValue, resetLogs, upsertBots]);

  const handleRemove = useCallback(
    (entry: ImportedBotEntry) => {
      removeBot(entry.id);
      setSelection((prev) => {
        if (!prev.has(entry.id)) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(entry.id);
        return next;
      });
      appendLog(`Удалён бот ${entry.summary.name}.`, 'info');
    },
    [appendLog, removeBot],
  );

  const handleClearAll = useCallback(() => {
    if (importedBots.length === 0) {
      return;
    }
    clearAll();
    setSelection(new Map());
    appendLog('Список импортированных ботов очищен.', 'info');
  }, [appendLog, clearAll, importedBots.length]);

  useEffect(() => {
    if (!isImporting) {
      return;
    }
    if (!extensionReady) {
      setIsImporting(false);
    }
  }, [extensionReady, isImporting]);

  const openModal = useCallback((variant: BacktestVariant) => {
    if (selection.size === 0) {
      return;
    }
    setActiveModal(variant);
  }, [selection.size]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const hasImportedBots = importedBots.length > 0;
  const allSelected = hasImportedBots && selection.size === importedBots.length;
  const someSelected = selection.size > 0 && selection.size < importedBots.length;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Импорт ботов</h1>
        <p className="page__subtitle">Вставьте ссылки или идентификаторы, чтобы загрузить конфигурации ботов по общему доступу.</p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение не активно. Импорт возможен только при запуске внутри расширения Chrome.
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">Добавление новых ботов</h2>
        <p className="panel__description">
          Поддерживаются ссылки вида https://veles.finance/share/&lt;код&gt;, разделённые запятой или с новой строки. Можно вставлять сами коды.
        </p>
        <textarea
          className="input"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={'https://veles.finance/share/pvXzq\nhttps://veles.finance/share/q1w2e'}
          rows={4}
        />
        <div className="panel__actions" style={{ marginTop: 12 }}>
          <button type="button" className="button" onClick={handleImport} disabled={!extensionReady || isImporting}>
            {isImporting ? 'Импортируем…' : 'Импортировать'}
          </button>
          <button type="button" className="button button--ghost" onClick={() => setInputValue('')} disabled={isImporting}>
            Очистить поле
          </button>
        </div>
        {logs.length > 0 && (
          <ul className="panel__list" style={{ marginTop: 16 }}>
            {logs.map((log) => (
              <li key={log.id} style={{ color: log.kind === 'error' ? '#ef4444' : log.kind === 'success' ? '#10b981' : '#94a3b8' }}>
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Импортированные боты</h2>
            <p className="panel__description">
              Храним конфигурации локально. Можно выбрать ботов для запуска бэктестов или удалить ненужных.
            </p>
          </div>
          <div className="panel__actions">
            <button type="button" className="button button--ghost" onClick={handleClearAll} disabled={!hasImportedBots}>
              Очистить список
            </button>
          </div>
        </div>

        {hasImportedBots ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="table__checkbox">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={allSelected}
                      ref={(node) => {
                        if (node) {
                          node.indeterminate = someSelected;
                        }
                      }}
                      onChange={(event) => toggleAllSelection(event.target.checked)}
                      aria-label="Выбрать всех импортированных ботов"
                    />
                  </th>
                  <th>Название</th>
                  <th>Биржа</th>
                  <th>Алгоритм</th>
                  <th>Тикеры</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {importedBots.map((entry) => {
                  const isChecked = selection.has(entry.id);
                  return (
                    <tr key={entry.id}>
                      <td className="table__checkbox">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelection(entry)}
                          aria-label={`Выбрать бота ${entry.summary.name}`}
                        />
                      </td>
                      <td>
                        <div>{entry.summary.name}</div>
                        <div className="panel__description">Код: {entry.alias}</div>
                      </td>
                      <td>{entry.summary.exchange}</td>
                      <td>{entry.summary.algorithm}</td>
                      <td>{inferenceSymbols(entry.strategy)}</td>
                      <td>
                        <div>{entry.summary.status}</div>
                        {entry.summary.substatus && <div className="panel__description">{entry.summary.substatus}</div>}
                      </td>
                      <td>
                        <button type="button" className="button button--ghost" onClick={() => handleRemove(entry)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Ещё нет импортированных ботов.</div>
        )}

        {totalSelected > 0 && (
          <div className="panel__bulk-actions">
            <span className="panel__bulk-info">Выбрано {totalSelected} ботов</span>
            <div className="panel__bulk-buttons">
              <button type="button" className="button" onClick={() => openModal('single')}>
                Бэктест
              </button>
              <button type="button" className="button button--secondary" onClick={() => openModal('multiCurrency')}>
                Мультивалютный бэктест
              </button>
            </div>
          </div>
        )}
      </div>

      {activeModal && <BacktestModal variant={activeModal} selectedBots={selectedBotsList} onClose={closeModal} />}
    </section>
  );
};

export default ImportBotsPage;
