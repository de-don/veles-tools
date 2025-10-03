import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { fetchBacktests } from '../api/backtests';
import type { BacktestStatistics, BacktestStatisticsListResponse } from '../types/backtests';

interface BacktestsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_SORT = 'date,desc';

type SelectionMap = Map<number, BacktestSelection>;

interface BacktestSelection {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  quote: string;
  profitQuote: number | null;
  netQuote: number | null;
}

const createSummary = (item: BacktestStatistics): BacktestSelection => ({
  id: item.id,
  name: item.name,
  symbol: item.symbol,
  exchange: item.exchange,
  quote: item.quote,
  profitQuote: item.profitQuote,
  netQuote: item.netQuote,
});

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const durationFormatter = (value: number | null) => {
  if (value === null) {
    return '—';
  }
  const minutes = Math.floor(value / 60);
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч`;
  }
  const days = Math.floor(hours / 24);
  return `${days} д`;
};

const formatAmount = (value: number | null, suffix?: string) => {
  if (value === null) {
    return '—';
  }
  return `${numberFormatter.format(value)}${suffix ? ` ${suffix}` : ''}`;
};

const formatPercent = (value: number | null) => {
  if (value === null) {
    return '—';
  }
  return `${percentageFormatter.format(value)}%`;
};

const BacktestsPage = ({ extensionReady }: BacktestsPageProps) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const sort = DEFAULT_SORT;
  const [data, setData] = useState<BacktestStatisticsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionMap>(new Map());
  const selectAllRef = useRef<HTMLInputElement | null>(null);

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

    fetchBacktests({ page, size: pageSize, sort })
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
  }, [extensionReady, page, pageSize, sort]);

  useEffect(() => {
    if (!extensionReady) {
      setSelection(new Map());
    }
  }, [extensionReady]);

  const items = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const totalSelected = selection.size;

  const currentPageSelectedCount = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return items.filter((item) => selection.has(item.id)).length;
  }, [items, selection]);

  const allCurrentSelected = items.length > 0 && currentPageSelectedCount === items.length;
  const someCurrentSelected = currentPageSelectedCount > 0 && currentPageSelectedCount < items.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentSelected;
    }
  }, [someCurrentSelected, allCurrentSelected]);

  const toggleSelection = (item: BacktestStatistics) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, createSummary(item));
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (!checked) {
        items.forEach((item) => {
          next.delete(item.id);
        });
        return next;
      }

      items.forEach((item) => {
        next.set(item.id, createSummary(item));
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

  const clearSelection = () => {
    setSelection(new Map());
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Бэктесты</h1>
        <p className="page__subtitle">
          Журнал завершённых бэктестов с ключевыми метриками, пагинацией и возможностью выбирать результаты для дальнейшей обработки.
        </p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение не активно. Откройте UI из расширения, чтобы загрузить список бэктестов.
        </div>
      )}

      <div className="panel">
        <div className="panel__header">
          <div className="panel__meta">
            <span className="badge">Всего: {totalElements}</span>
            <span className="badge">Выбрано: {totalSelected}</span>
            <span className="badge">Сортировка: {DEFAULT_SORT.replace(',', ' ')}</span>
          </div>
          <div className="panel__actions">
            <label>
              <span style={{ marginRight: 6 }}>На странице:</span>
              <select className="select" value={pageSize} onChange={handlePageSizeChange}>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button button--ghost" onClick={clearSelection} disabled={totalSelected === 0}>
              Сбросить выбор
            </button>
          </div>
        </div>

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
                    disabled={items.length === 0}
                  />
                </th>
                <th>Название</th>
                <th>Период</th>
                <th>Средняя длит.</th>
                <th>Биржа</th>
                <th>Пара</th>
                <th>Прибыль</th>
                <th>Net / день</th>
                <th>Сделки</th>
                <th>Win rate</th>
                <th>MFE / MAE</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11}>
                    <div className="loader">Загружаем данные…</div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">Нет данных для отображения.</div>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item) => {
                  const isChecked = selection.has(item.id);
                  return (
                    <tr key={item.id}>
                      <td className="table__checkbox">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelection(item)}
                          aria-label={`Выбрать бэктест ${item.name}`}
                        />
                      </td>
                      <td>
                        <div>{item.name}</div>
                        <div className="panel__description">ID: {item.id}</div>
                      </td>
                      <td>
                        <div>{new Date(item.from).toLocaleDateString()}</div>
                        <div className="panel__description">до {new Date(item.to).toLocaleDateString()}</div>
                      </td>
                      <td>{durationFormatter(item.avgDuration)}</td>
                      <td>{item.exchange}</td>
                      <td>
                        <div>{item.symbol}</div>
                        <div className="panel__description">{item.algorithm}</div>
                      </td>
                      <td>
                        <div>{formatAmount(item.profitQuote, item.quote)}</div>
                        <div className="panel__description">Base: {formatAmount(item.profitBase, item.base)}</div>
                      </td>
                      <td>
                        <div>{formatAmount(item.netQuote, item.quote)}</div>
                        <div className="panel__description">в день: {formatAmount(item.netQuotePerDay, item.quote)}</div>
                      </td>
                      <td>
                        <div>Всего: {item.totalDeals ?? '—'}</div>
                        <div className="panel__description">P/L/B: {item.profits ?? 0}/{item.losses ?? 0}/{item.breakevens ?? 0}</div>
                      </td>
                      <td>
                        <div>{formatPercent(item.winRateProfits)}</div>
                        <div className="panel__description">Loss: {formatPercent(item.winRateLosses)}</div>
                      </td>
                      <td>
                        <div>MFE: {formatPercent(item.mfePercent)}</div>
                        <div className="panel__description">MAE: {formatPercent(item.maePercent)}</div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div>
            Страница {page + 1} из {Math.max(totalPages, 1)}
          </div>
          <div className="pagination__controls">
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
        <h2 className="panel__title">Выбранные бэктесты</h2>
        <p className="panel__description">
          Эти результаты будут использоваться для дальнейшего анализа и интеграции с мультизапуском.
        </p>
        {totalSelected === 0 ? (
          <div className="empty-state">Выберите один или несколько бэктестов в таблице.</div>
        ) : (
          <ul className="panel__list--compact">
            {Array.from(selection.values()).map((item) => (
              <li key={item.id}>
                <span className="chip">
                  <strong>{item.name}</strong>
                  <span>{item.symbol}</span>
                </span>
                <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                  {formatAmount(item.profitQuote, item.quote)}
                </span>
                {item.netQuote !== null && (
                  <span style={{ marginLeft: 8, color: '#94a3b8' }}>Net: {formatAmount(item.netQuote, item.quote)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default BacktestsPage;
