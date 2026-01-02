import type { TableProps } from 'antd';
import { Button, Card, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type BotStrategy, fetchBotStrategy } from '../api/backtestRunner';
import BacktestModal, { type BacktestVariant } from '../components/BacktestModal';
import SelectionSummaryBar from '../components/ui/SelectionSummaryBar';
import { TableColumnSettingsButton } from '../components/ui/TableColumnSettingsButton';
import { type ImportedBotEntry, useImportedBots } from '../context/ImportedBotsContext';
import { buildVelesUrl } from '../lib/cabinetUrls';
import { resolveBotStatusColor } from '../lib/statusColors';
import { useTableColumnSettings } from '../lib/useTableColumnSettings';
import { BOT_STATUS_VALUES, type BotStatus, type BotSummary } from '../types/bots';

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

const normalizeStatusValue = (value: string | null | undefined): BotStatus => {
  if (typeof value !== 'string') {
    return 'FAILED';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 'FAILED';
  }

  const upperCased = trimmed.toUpperCase();
  const match = BOT_STATUS_VALUES.find((status) => status === upperCased);
  if (match) {
    return match;
  }

  return 'FAILED';
};

const normalizeAliasCandidate = (candidate: string): string | null => {
  const trimmed = candidate.trim().replace(/["'[\]]/g, '');
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

const getBotsNoun = (count: number): string => {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) {
    return 'ботов';
  }
  if (last === 1) {
    return 'бот';
  }
  if (last >= 2 && last <= 4) {
    return 'бота';
  }
  return 'ботов';
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

  const normalized = tokens.map(normalizeAliasCandidate).filter((item): item is string => Boolean(item));

  return deduplicate(normalized);
};

const buildImportedEntry = (alias: string, strategy: BotStrategy): ImportedBotEntry => {
  const name =
    typeof strategy.name === 'string' && strategy.name.trim().length > 0 ? strategy.name.trim() : `Бот ${alias}`;
  const exchange =
    typeof strategy.exchange === 'string' && strategy.exchange.trim().length > 0 ? strategy.exchange.trim() : '—';
  const rawStatus = typeof strategy.status === 'string' ? strategy.status.trim() : null;
  const status = normalizeStatusValue(rawStatus);
  const substatus = (() => {
    if (typeof strategy.substatus === 'string' && strategy.substatus.trim().length > 0) {
      return strategy.substatus.trim();
    }
    if (rawStatus && status !== rawStatus.toUpperCase()) {
      return rawStatus;
    }
    return null;
  })();
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
    sourceUrl: buildVelesUrl(`share/${alias}`),
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
  const [selectionDetailsOpen, setSelectionDetailsOpen] = useState(false);

  const shareBaseUrl = buildVelesUrl('share');

  const importedIds = useMemo(() => new Set(importedBots.map((entry) => entry.id)), [importedBots]);
  const lastSelectedKeyRef = useRef<string | null>(null);

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
    lastSelectedKeyRef.current = null;
  }, [importedIds]);

  const selectedRowKeys = useMemo(() => Array.from(selection.keys()), [selection]);

  const handleRowSelect = useCallback(
    (record: ImportedBotEntry, selected: boolean, shiftKey: boolean) => {
      setSelection((prev) => {
        const next = new Map(prev);
        const applySelection = (entry: ImportedBotEntry) => {
          if (selected) {
            next.set(entry.id, entry.summary);
          } else {
            next.delete(entry.id);
          }
        };

        if (shiftKey && lastSelectedKeyRef.current) {
          const currentIndex = importedBots.findIndex((entry) => entry.id === record.id);
          const lastIndex = importedBots.findIndex((entry) => entry.id === lastSelectedKeyRef.current);
          if (currentIndex !== -1 && lastIndex !== -1) {
            const [start, end] = currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];
            for (let index = start; index <= end; index += 1) {
              applySelection(importedBots[index]);
            }
          } else {
            applySelection(record);
          }
        } else {
          applySelection(record);
        }

        return next;
      });
      lastSelectedKeyRef.current = record.id;
    },
    [importedBots],
  );

  const handleRowSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const next = new Map<string, BotSummary>();
        importedBots.forEach((entry) => {
          next.set(entry.id, entry.summary);
        });
        setSelection(next);
      } else {
        setSelection(new Map());
      }
      lastSelectedKeyRef.current = null;
    },
    [importedBots],
  );

  const rowSelection = useMemo<NonNullable<TableProps<ImportedBotEntry>['rowSelection']>>(
    () => ({
      type: 'checkbox',
      preserveSelectedRowKeys: true,
      selectedRowKeys,
      onSelect: (record, selected, _selectedRows, nativeEvent) => {
        const shiftKey = Boolean((nativeEvent as MouseEvent | KeyboardEvent | undefined)?.shiftKey);
        handleRowSelect(record, selected, shiftKey);
      },
      onSelectAll: (checked: boolean) => {
        handleRowSelectAll(checked);
      },
    }),
    [selectedRowKeys, handleRowSelect, handleRowSelectAll],
  );

  const selectedBotsList = useMemo(() => Array.from(selection.values()), [selection]);
  const totalSelected = selection.size;

  useEffect(() => {
    if (totalSelected === 0 && selectionDetailsOpen) {
      setSelectionDetailsOpen(false);
    }
  }, [totalSelected, selectionDetailsOpen]);

  const appendLog = useCallback((message: string, kind: LogKind) => {
    setLogs((current) => [{ id: buildLogEntryId(kind), message, kind }, ...current]);
  }, []);

  const resetLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleImport = useCallback(async () => {
    resetLogs();
    if (!extensionReady) {
      appendLog('Расширение Veles Tools неактивно — импорт невозможен.', 'error');
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

  const baseTableColumns: ColumnsType<ImportedBotEntry> = useMemo(
    () => [
      {
        title: 'Название',
        dataIndex: ['summary', 'name'],
        key: 'name',
        render: (_value, entry) => (
          <div>
            <div>{entry.summary.name}</div>
            <div className="panel__description">Код: {entry.alias}</div>
          </div>
        ),
      },
      {
        title: 'Биржа',
        dataIndex: ['summary', 'exchange'],
        key: 'exchange',
        render: (_value, entry) => entry.summary.exchange,
      },
      {
        title: 'Алгоритм',
        dataIndex: ['summary', 'algorithm'],
        key: 'algorithm',
        render: (_value, entry) => entry.summary.algorithm,
      },
      {
        title: 'Тикеры',
        dataIndex: 'strategy',
        key: 'symbols',
        render: (_value, entry) => inferenceSymbols(entry.strategy),
      },
      {
        title: 'Статус',
        dataIndex: ['summary', 'status'],
        key: 'status',
        render: (_value, entry) => (
          <div>
            <Tag
              color={resolveBotStatusColor(entry.summary.status)}
              className={entry.summary.substatus ? 'tag--with-substatus' : undefined}
            >
              {entry.summary.status}
            </Tag>
            {entry.summary.substatus && <div className="panel__description">{entry.summary.substatus}</div>}
          </div>
        ),
      },
      {
        title: 'Действия',
        key: 'actions',
        render: (_value, entry) => (
          <Button type="link" danger onClick={() => handleRemove(entry)}>
            Удалить
          </Button>
        ),
      },
    ],
    [handleRemove],
  );

  const {
    columns: tableColumns,
    settings: tableColumnSettings,
    moveColumn: moveTableColumn,
    setColumnVisibility: setTableColumnVisibility,
    reset: resetTableColumns,
    hasCustomSettings: tableHasCustomSettings,
  } = useTableColumnSettings<ImportedBotEntry>({
    tableKey: 'import-bots-table',
    columns: baseTableColumns,
  });

  const tablePagination = useMemo(
    () => ({
      defaultPageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50'],
    }),
    [],
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

  const openModal = useCallback(
    (variant: BacktestVariant) => {
      if (selection.size === 0) {
        return;
      }
      setActiveModal(variant);
    },
    [selection.size],
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const hasImportedBots = importedBots.length > 0;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Импорт ботов</h1>
        <p className="page__subtitle">Вставьте публичные ссылки на ботов, чтобы загрузить их конфигурации.</p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение Veles Tools неактивно. Импорт доступен только при запуске внутри интерфейса расширения.
        </div>
      )}

      <Card title="Добавление новых ботов">
        <p className="panel__description">
          Поддерживаются ссылки вида {`${shareBaseUrl}/<код>`}, разделённые запятой или с новой строки. Можно вставлять
          сами коды.
        </p>
        <textarea
          className="input u-full-width"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={`${shareBaseUrl}/pvXzq
${shareBaseUrl}/q1w2e`}
          rows={4}
        />
        <Space className="panel__actions u-mt-12" wrap>
          <Button type="primary" onClick={handleImport} loading={isImporting} disabled={!extensionReady}>
            Импортировать
          </Button>
          <Button onClick={() => setInputValue('')} disabled={isImporting}>
            Очистить поле
          </Button>
        </Space>
        {logs.length > 0 && (
          <ul className="panel__list u-mt-16">
            {logs.map((log) => (
              <li key={log.id} className={`panel__list-item panel__list-item--${log.kind}`}>
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Импортированные боты">
        <div className="panel__header">
          <div>
            <p className="panel__description">
              Храним конфигурации локально. Можно выбрать ботов для запуска бэктестов или удалить ненужных.
            </p>
          </div>
          <Space className="panel__actions" size={[8, 8]} wrap>
            <TableColumnSettingsButton
              settings={tableColumnSettings}
              moveColumn={moveTableColumn}
              setColumnVisibility={setTableColumnVisibility}
              reset={resetTableColumns}
              hasCustomSettings={tableHasCustomSettings}
            />
            <Button onClick={handleClearAll} disabled={!hasImportedBots}>
              Очистить список
            </Button>
          </Space>
        </div>

        {hasImportedBots ? (
          <div className="table-container">
            <Table<ImportedBotEntry>
              columns={tableColumns}
              dataSource={importedBots}
              rowKey={(entry) => entry.id}
              rowSelection={rowSelection}
              pagination={tablePagination}
              locale={{ emptyText: 'Импортированных ботов нет.' }}
              scroll={{ x: true }}
            />
          </div>
        ) : (
          <div className="empty-state">Ещё нет импортированных ботов.</div>
        )}

        {totalSelected > 0 ? (
          <SelectionSummaryBar
            message={
              <>
                Выбрано {totalSelected}{' '}
                <Button type="link" size="small" onClick={() => setSelectionDetailsOpen(true)}>
                  {getBotsNoun(totalSelected)}
                </Button>
              </>
            }
            actions={
              <>
                <Button type="primary" onClick={() => openModal('single')}>
                  Бэктест
                </Button>
                <Button onClick={() => openModal('multiCurrency')}>Мультивалютный бэктест</Button>
              </>
            }
          />
        ) : null}
      </Card>

      {activeModal && <BacktestModal variant={activeModal} selectedBots={selectedBotsList} onClose={closeModal} />}

      <Modal
        title={`Выбрано ${totalSelected} ${getBotsNoun(totalSelected)}`}
        open={selectionDetailsOpen}
        onCancel={() => setSelectionDetailsOpen(false)}
        footer={null}
        width={520}
      >
        {selectedBotsList.length === 0 ? (
          <Typography.Text type="secondary">Список пуст — выберите ботов в таблице.</Typography.Text>
        ) : (
          <ul className="panel__list--compact panel__list--scroll">
            {selectedBotsList.map((bot) => (
              <li key={bot.id}>
                <span className="chip">
                  <strong>{bot.name}</strong>
                  <span>
                    {bot.exchange} · {bot.algorithm}
                  </span>
                </span>
                <span className="u-ml-8 text-muted">ID: {bot.id}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
};

export default ImportBotsPage;
