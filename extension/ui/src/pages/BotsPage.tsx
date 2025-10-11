import {type FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import type {TableProps} from 'antd';
import {Table, Tag} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {fetchBots} from '../api/bots';
import {fetchApiKeys} from '../api/apiKeys';
import type {BotAlgorithm, BotsListFilters, BotsListResponse, BotStatus, BotSummary, TradingBot,} from '../types/bots';
import {BOT_STATUS_VALUES} from '../types/bots';
import type {ApiKey} from '../types/apiKeys';
import BacktestModal, {type BacktestVariant} from '../components/BacktestModal';
import BulkActionsMenu from '../components/bots/BulkActionsMenu';
import {parseSortDescriptor, serializeSortDescriptor} from '../lib/tableSort';
import {resolveBotStatusColor} from '../lib/statusColors';
import type {TableRowSelection} from 'antd/es/table/interface';

interface BotsPageProps {
    extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SORT = 'createdAt,desc';

const STATUS_OPTIONS: readonly BotStatus[] = BOT_STATUS_VALUES;

const ALGORITHM_OPTIONS: BotAlgorithm[] = ['LONG', 'SHORT'];


const formatStatusLabel = (status: BotStatus): string => {
    return status
        .toLowerCase()
        .split('_')
        .map((chunk) => (chunk ? `${chunk[0].toUpperCase()}${chunk.slice(1)}` : ''))
        .join(' ')
        .trim();
};

const formatAlgorithmLabel = (algorithm: BotAlgorithm): string => {
    if (algorithm === 'LONG') {
        return 'Лонг';
    }
    if (algorithm === 'SHORT') {
        return 'Шорт';
    }
    return algorithm;
};

const formatExchangeLabel = (exchange: string): string => {
    return exchange
        .toLowerCase()
        .split('_')
        .map((chunk) => (chunk ? `${chunk[0].toUpperCase()}${chunk.slice(1)}` : ''))
        .join(' ')
        .trim();
};

const _createSummary = (bot: TradingBot): BotSummary => ({
    id: bot.id,
    name: bot.name,
    exchange: bot.exchange,
    algorithm: bot.algorithm,
    status: bot.status,
    substatus: bot.substatus,
    origin: 'account',
});

const BotsPage = ({extensionReady}: BotsPageProps) => {
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [sort, setSort] = useState(DEFAULT_SORT);
    const [data, setData] = useState<BotsListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selection, setSelection] = useState<TradingBot[]>([]);
    const [activeModal, setActiveModal] = useState<BacktestVariant | null>(null);
    const [nameFilter, setNameFilter] = useState('');
    const [apiKeyFilter, setApiKeyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<BotStatus | ''>('');
    const [algorithmFilter, setAlgorithmFilter] = useState<BotAlgorithm | ''>('');
    const [appliedFilters, setAppliedFilters] = useState<BotsListFilters>({});
    const [filtersError, setFiltersError] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(false);
    const [apiKeysError, setApiKeysError] = useState<string | null>(null);
    const [reloadCounter, setReloadCounter] = useState(0);

    useEffect(() => {
        if (!extensionReady) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        let isActive = true;
        setLoading(true);
        setError(null);

        fetchBots({page, size: pageSize, sort, filters: appliedFilters})
            .then((response) => {
                if (!isActive) {
                    return;
                }
                setData(response);
            })
            .catch((requestError: unknown) => {
                if (!isActive) {
                    return;
                }
                const message = requestError instanceof Error ? requestError.message : String(requestError);
                setError(message);
            })
            .finally(() => {
                if (isActive) {
                    setLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [extensionReady, page, pageSize, sort, appliedFilters, reloadCounter]);

    useEffect(() => {
        if (!extensionReady) {
            setSelection([]);
            setActiveModal(null);
        }
    }, [extensionReady]);

    useEffect(() => {
        if (!extensionReady) {
            setApiKeys([]);
            setApiKeysError(null);
            setApiKeysLoading(false);
            return;
        }

        let isActive = true;
        setApiKeysLoading(true);
        setApiKeysError(null);

        fetchApiKeys({size: 100})
            .then((keys) => {
                if (!isActive) {
                    return;
                }
                setApiKeys(keys);
            })
            .catch((requestError: unknown) => {
                if (!isActive) {
                    return;
                }
                const message = requestError instanceof Error ? requestError.message : String(requestError);
                setApiKeysError(message);
            })
            .finally(() => {
                if (isActive) {
                    setApiKeysLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [extensionReady]);

    useEffect(() => {
        setSelection([]);
        setActiveModal(null);
    }, []);

    const apiKeyOptions = useMemo(
        () =>
            apiKeys.map((key) => ({
                value: String(key.id),
                label: key.name
                    ? `${key.name} · ${formatExchangeLabel(key.exchange)}`
                    : `#${key.id}`,
            })),
        [apiKeys],
    );
    const forceReloadBots = useCallback(() => {
        setReloadCounter((value) => value + 1);
    }, []);
    const hasActiveFilters = useMemo(() => {
        return Boolean(
            appliedFilters.name ||
            appliedFilters.apiKey ||
            (appliedFilters.statuses && appliedFilters.statuses.length > 0) ||
            (appliedFilters.algorithms && appliedFilters.algorithms.length > 0),
        );
    }, [appliedFilters]);
    const hasFilterDraft =
        nameFilter.trim().length > 0 ||
        apiKeyFilter !== '' ||
        Boolean(statusFilter) ||
        Boolean(algorithmFilter);
    const isResetDisabled = !hasActiveFilters && !hasFilterDraft;

    const selectedRowKeys = useMemo(() => selection.map(s => s.id), [selection]);

    const totalSelected = selection.length;
    const bots = data?.content ?? [];
    const totalElements = data?.totalElements ?? bots.length;

    const currentSortDescriptor = useMemo(() => parseSortDescriptor(sort), [sort]);

    const rowSelection: TableRowSelection<TradingBot> = {
        selectedRowKeys,
        type: 'checkbox',
        preserveSelectedRowKeys: true,
        onChange: (_nextSelectedRowKeys, nextSelectedRows) => {
            setSelection(nextSelectedRows);
        }
    };

    const handleTableChange = useCallback<NonNullable<TableProps<TradingBot>['onChange']>>(
        (pagination, _filters, sorter) => {
            const nextPageSize = pagination?.pageSize ?? pageSize;
            const isPageSizeChanged = nextPageSize !== pageSize;
            if (isPageSizeChanged) {
                setPageSize(nextPageSize);
                setPage(0);
            } else {
                const pageIndex = Math.max((pagination?.current ?? 1) - 1, 0);
                setPage(pageIndex);
            }

            if (!Array.isArray(sorter)) {
                if (sorter?.order && typeof sorter.field === 'string') {
                    setSort(serializeSortDescriptor({field: sorter.field, order: sorter.order}));
                } else if (!sorter?.order) {
                    setSort(DEFAULT_SORT);
                }
            }
        },
        [pageSize],
    );

    const columns: ColumnsType<TradingBot> = useMemo(
        () => [
            {
                title: 'Название',
                dataIndex: 'name',
                key: 'name',
                sorter: true,
                sortOrder: currentSortDescriptor?.field === 'name' ? currentSortDescriptor.order : undefined,
                render: (_value, botRecord) => (
                    <div>
                        <div>{botRecord.name}</div>
                        <div className="panel__description">ID: {botRecord.id}</div>
                    </div>
                ),
            },
            {
                title: 'Биржа',
                dataIndex: 'exchange',
                key: 'exchange',
                render: (value: string) => formatExchangeLabel(value),
            },
            {
                title: 'Алгоритм',
                dataIndex: 'algorithm',
                key: 'algorithm',
                render: (value: BotAlgorithm) => formatAlgorithmLabel(value),
            },
            {
                title: 'Статус',
                dataIndex: 'status',
                key: 'status',
                render: (_value, botRecord) => (
                    <div>
                        <Tag color={resolveBotStatusColor(botRecord.status)}
                             style={{marginBottom: botRecord.substatus ? 4 : 0}}>
                            {formatStatusLabel(botRecord.status)}
                        </Tag>
                        {botRecord.substatus && <div className="panel__description">{botRecord.substatus}</div>}
                    </div>
                ),
            },
            {
                title: 'Тикеры',
                dataIndex: 'symbols',
                key: 'symbols',
                render: (value: string[]) => (value && value.length > 0 ? value.join(', ') : '—'),
            },
            {
                title: 'Создан',
                dataIndex: 'createdAt',
                key: 'createdAt',
                sorter: true,
                sortOrder: currentSortDescriptor?.field === 'createdAt' ? currentSortDescriptor.order : undefined,
                render: (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '—'),
            },
            {
                title: 'Обновлён',
                dataIndex: 'updatedAt',
                key: 'updatedAt',
                sorter: true,
                sortOrder: currentSortDescriptor?.field === 'updatedAt' ? currentSortDescriptor.order : undefined,
                render: (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '—'),
            },
        ],
        [currentSortDescriptor],
    );

    const tablePagination = useMemo(() => ({
        current: page + 1,
        pageSize,
        showSizeChanger: true,
        pageSizeOptions: PAGE_SIZE_OPTIONS.map((option) => String(option)),
        total: totalElements,
        showTotal: (total: number, range: [number, number]) => `${range[0]}–${range[1]} из ${total}`,
    }), [page, pageSize, totalElements]);

    const selectedBotsList = useMemo(() => Array.from(selection.values()), [selection]);

    const handleFiltersApply = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextFilters: BotsListFilters = {};
        const normalizedName = nameFilter.trim();
        if (normalizedName) {
            nextFilters.name = normalizedName;
        }

        if (apiKeyFilter) {
            const apiKeyValue = Number.parseInt(apiKeyFilter, 10);
            if (!Number.isSafeInteger(apiKeyValue) || apiKeyValue <= 0) {
                setFiltersError('Некорректный выбор API-ключа.');
                return;
            }

            nextFilters.apiKey = apiKeyValue;
        }

        setFiltersError(null);
        if (statusFilter) {
            nextFilters.statuses = [statusFilter];
        }

        if (algorithmFilter) {
            nextFilters.algorithms = [algorithmFilter];
        }

        setError(null);
        setAppliedFilters(nextFilters);
        setPage(0);
    };

    const handleFiltersReset = () => {
        setNameFilter('');
        setApiKeyFilter('');
        setStatusFilter('');
        setAlgorithmFilter('');
        setAppliedFilters({});
        setFiltersError(null);
        setError(null);
        setPage(0);
    };

    useEffect(() => {
        if (totalSelected === 0 && activeModal) {
            setActiveModal(null);
        }
    }, [totalSelected, activeModal]);

    const openModal = (variant: BacktestVariant) => {
        if (totalSelected === 0) {
            return;
        }
        setActiveModal(variant);
    };

    const closeModal = () => {
        setActiveModal(null);
    };

    return (
        <section className="page">
            <header className="page__header">
                <h1 className="page__title">Мои боты</h1>
                <p className="page__subtitle">
                    Список всех ботов аккаунта veles.finance с пагинацией и возможностью выбора строк.
                </p>
            </header>

            {!extensionReady && (
                <div className="banner banner--warning">
                    Расширение Veles Tools неактивно. Запустите интерфейс из меню расширения, чтобы подгрузить список
                    ботов.
                </div>
            )}

            <div className="panel">
                {hasActiveFilters && (
                    <div className="panel__filters-state">
                        <span className="badge">Фильтры: активны</span>
                    </div>
                )}

                <form className="panel__filters" onSubmit={handleFiltersApply}>
                    <div className="filter-field">
                        <label htmlFor="bots-filter-name">Название</label>
                        <input
                            id="bots-filter-name"
                            className="input"
                            type="text"
                            placeholder="Например, BTC"
                            value={nameFilter}
                            onChange={(event) => {
                                setNameFilter(event.target.value);
                                setFiltersError(null);
                            }}
                            autoComplete="off"
                        />
                    </div>
                    <div className="filter-field">
                        <label htmlFor="bots-filter-api-key">API-ключ</label>
                        <select
                            id="bots-filter-api-key"
                            className="select"
                            value={apiKeyFilter}
                            onChange={(event) => {
                                setApiKeyFilter(event.target.value);
                                setFiltersError(null);
                            }}
                            disabled={apiKeysLoading}
                        >
                            <option value="">Все ключи</option>
                            {apiKeyOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {apiKeysLoading && <span className="form-hint">Загружаем ключи…</span>}
                        {apiKeysError && <span className="form-error">{apiKeysError}</span>}
                    </div>
                    <div className="filter-field">
                        <label htmlFor="bots-filter-status">Статус</label>
                        <select
                            id="bots-filter-status"
                            className="select"
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value as BotStatus | '');
                                setFiltersError(null);
                            }}
                        >
                            <option value="">Все статусы</option>
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {formatStatusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-field">
                        <label htmlFor="bots-filter-algorithm">Тип</label>
                        <select
                            id="bots-filter-algorithm"
                            className="select"
                            value={algorithmFilter}
                            onChange={(event) => {
                                setAlgorithmFilter(event.target.value as BotAlgorithm | '');
                                setFiltersError(null);
                            }}
                        >
                            <option value="">Все</option>
                            {ALGORITHM_OPTIONS.map((algorithm) => (
                                <option key={algorithm} value={algorithm}>
                                    {formatAlgorithmLabel(algorithm)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="panel__filters-actions">
                        <button type="submit" className="button">
                            Применить
                        </button>
                        <button type="button" className="button button--ghost" onClick={handleFiltersReset}
                                disabled={isResetDisabled}>
                            Сбросить фильтры
                        </button>
                    </div>
                </form>
                {filtersError && (
                    <div className="form-error" style={{marginTop: 8}}>
                        {filtersError}
                    </div>
                )}

                {totalSelected > 0 && (
                    <div className="panel__bulk-actions">
                        <span className="panel__bulk-info">Выбрано {totalSelected} ботов</span>
                        <div className="panel__bulk-buttons">
                            <button type="button" className="button" onClick={() => openModal('single')}>
                                Бэктест
                            </button>
                            <button type="button" className="button button--secondary"
                                    onClick={() => openModal('multiCurrency')}>
                                Мультивалютный бэктест
                            </button>
                            <BulkActionsMenu
                                bots={selection}
                                onReloadRequested={forceReloadBots}
                                onSelectionUpdate={setSelection}
                            />
                        </div>
                    </div>
                )}

                <div className="table-container">
                    <Table<TradingBot>
                        columns={columns}
                        dataSource={bots}
                        rowKey={(botRecord) => botRecord.id}
                        rowSelection={rowSelection}
                        pagination={tablePagination}
                        loading={loading}
                        onChange={handleTableChange}
                        scroll={{x: true}}
                        size="middle"
                        locale={{emptyText: loading ? 'Загружаем данные…' : 'Нет данных для отображения.'}}
                        sticky
                    />
                </div>

                {error && <div className="banner banner--warning">Ошибка загрузки: {error}</div>}
            </div>

            <div className="panel">
                <h2 className="panel__title">Выбранные боты</h2>
                <p className="panel__description">
                    Эти боты будут доступны для последующих действий (массовые операции, запуск бэктестов и т. д.).
                </p>
                {totalSelected === 0 ? (
                    <div className="empty-state">Выберите одного или несколько ботов в таблице.</div>
                ) : (
                    <ul className="panel__list--compact">
                        {selection.map((bot) => (
                            <li key={bot.id}>
                <span className="chip">
                  <strong>{bot.name}</strong>
                  <span>
                    {bot.exchange} · {bot.algorithm}
                  </span>
                </span>
                                <span style={{marginLeft: 8, color: '#94a3b8'}}>Статус: {bot.status}</span>
                                {bot.substatus &&
                                    <span style={{marginLeft: 8, color: '#94a3b8'}}>({bot.substatus})</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {activeModal && (
                <BacktestModal variant={activeModal} selectedBots={selectedBotsList} onClose={closeModal}/>
            )}
        </section>
    );
};

export default BotsPage;
