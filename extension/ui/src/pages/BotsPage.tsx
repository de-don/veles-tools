import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchBots } from '../api/bots';
import { fetchApiKeys } from '../api/apiKeys';
import type {
  BotAlgorithm,
  BotStatus,
  BotSummary,
  BotsListFilters,
  BotsListResponse,
  TradingBot,
} from '../types/bots';
import { BOT_STATUS_VALUES } from '../types/bots';
import type { ApiKey } from '../types/apiKeys';
import BacktestModal, { type BacktestVariant } from '../components/BacktestModal';

interface BotsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SORT = 'createdAt,desc';

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'createdAt,desc', label: 'Дата создания ↓' },
  { value: 'createdAt,asc', label: 'Дата создания ↑' },
  { value: 'updatedAt,desc', label: 'Дата обновления ↓' },
  { value: 'updatedAt,asc', label: 'Дата обновления ↑' },
  { value: 'name,asc', label: 'Название A→Я' },
  { value: 'name,desc', label: 'Название Я→A' },
];

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

type SelectionMap = Map<string, BotSummary>;

const createSummary = (bot: TradingBot): BotSummary => ({
  id: bot.id,
  name: bot.name,
  exchange: bot.exchange,
  algorithm: bot.algorithm,
  status: bot.status,
  substatus: bot.substatus,
  origin: 'account',
});

const BotsPage = ({ extensionReady }: BotsPageProps) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [data, setData] = useState<BotsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionMap>(new Map());
  const [activeModal, setActiveModal] = useState<BacktestVariant | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [apiKeyFilter, setApiKeyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<BotStatus | ''>('');
  const [algorithmFilter, setAlgorithmFilter] = useState<BotAlgorithm | ''>('');
  const [appliedFilters, setAppliedFilters] = useState<BotsListFilters>({});
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);

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

    fetchBots({ page, size: pageSize, sort, filters: appliedFilters })
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
  }, [extensionReady, page, pageSize, sort, appliedFilters]);

  useEffect(() => {
    if (!extensionReady) {
      setSelection(new Map());
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

    fetchApiKeys({ size: 100 })
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
    setSelection(new Map());
    setActiveModal(null);
  }, [appliedFilters]);

  const totalSelected = selection.size;
  const bots = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const selectedBotsList = useMemo(() => Array.from(selection.values()), [selection]);
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

  const currentPageSelectedCount = useMemo(() => {
    if (bots.length === 0) {
      return 0;
    }
    return bots.filter((bot) => selection.has(String(bot.id))).length;
  }, [bots, selection]);

  const allCurrentSelected = bots.length > 0 && currentPageSelectedCount === bots.length;
  const someCurrentSelected = currentPageSelectedCount > 0 && currentPageSelectedCount < bots.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentSelected;
    }
  }, [someCurrentSelected, allCurrentSelected]);

  const toggleBotSelection = (bot: TradingBot) => {
    const key = String(bot.id);
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, createSummary(bot));
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (!checked) {
        bots.forEach((bot) => {
          next.delete(String(bot.id));
        });
        return next;
      }

      bots.forEach((bot) => {
        next.set(String(bot.id), createSummary(bot));
      });
      return next;
    });
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((current) => {
      if (direction === 'prev') {
        return Math.max(current - 1, 0);
      }
      if (!data) {
        return current + 1;
      }
      return Math.min(current + 1, Math.max(data.totalPages - 1, 0));
    });
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value) || PAGE_SIZE_OPTIONS[0];
    setPageSize(value);
    setPage(0);
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSort(event.target.value);
    setPage(0);
  };

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
          Расширение Veles Tools неактивно. Запустите интерфейс из меню расширения, чтобы подгрузить список ботов.
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
            <label htmlFor="bots-sort">Сортировка</label>
            <select
              id="bots-sort"
              className="select"
              value={sort}
              onChange={handleSortChange}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
            <button type="button" className="button button--ghost" onClick={handleFiltersReset} disabled={isResetDisabled}>
              Сбросить фильтры
            </button>
          </div>
        </form>
        {filtersError && (
          <div className="form-error" style={{ marginTop: 8 }}>
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
              <button type="button" className="button button--secondary" onClick={() => openModal('multiCurrency')}>
                Мультивалютный бэктест
              </button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="table__checkbox">
                  <input
                    type="checkbox"
                    className="checkbox"
                    ref={selectAllRef}
                    checked={allCurrentSelected}
                    aria-label="Выбрать все на странице"
                    onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                    disabled={bots.length === 0}
                  />
                </th>
                <th>Название</th>
                <th>Биржа</th>
                <th>Алгоритм</th>
                <th>Статус</th>
                <th>Тикеры</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>
                    <div className="loader">Загружаем данные…</div>
                  </td>
                </tr>
              )}
              {!loading && bots.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">Нет данных для отображения.</div>
                  </td>
                </tr>
              )}
              {!loading &&
                bots.map((bot) => {
                  const key = String(bot.id);
                  const isChecked = selection.has(key);
                  return (
                    <tr key={bot.id}>
                      <td className="table__checkbox">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBotSelection(bot)}
                          aria-label={`Выбрать бота ${bot.name}`}
                        />
                      </td>
                      <td>
                        <div>{bot.name}</div>
                        <div className="panel__description">ID: {bot.id}</div>
                      </td>
                      <td>{bot.exchange}</td>
                      <td>{bot.algorithm}</td>
                      <td>
                        <div>{bot.status}</div>
                        {bot.substatus && <div className="panel__description">{bot.substatus}</div>}
                      </td>
                      <td>{bot.symbols.join(', ')}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="pagination__info">Страница {page + 1} из {Math.max(totalPages, 1)}</div>
          <div className="pagination__controls">
            <div className="pagination__page-size">
              <label className="pagination__page-size-label" htmlFor="bots-page-size">
                На странице:
              </label>
              <select id="bots-page-size" className="select" value={pageSize} onChange={handlePageSizeChange}>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="button button--ghost" onClick={() => handlePageChange('prev')} disabled={page === 0 || loading}>
              Назад
            </button>
            <button
              type="button"
              className="button"
              onClick={() => handlePageChange('next')}
              disabled={loading || totalPages === 0 || page + 1 >= totalPages}
            >
              Далее
            </button>
          </div>
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
            {Array.from(selection.values()).map((bot) => (
              <li key={bot.id}>
                <span className="chip">
                  <strong>{bot.name}</strong>
                  <span>
                    {bot.exchange} · {bot.algorithm}
                  </span>
                </span>
                <span style={{ marginLeft: 8, color: '#94a3b8' }}>Статус: {bot.status}</span>
                {bot.substatus && <span style={{ marginLeft: 8, color: '#94a3b8' }}>({bot.substatus})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeModal && (
        <BacktestModal variant={activeModal} selectedBots={selectedBotsList} onClose={closeModal} />
      )}
    </section>
  );
};

export default BotsPage;
