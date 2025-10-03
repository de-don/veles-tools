import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { fetchBots } from '../api/bots';
import type { BotSummary, BotsListResponse, TradingBot } from '../types/bots';
import BacktestModal, { type BacktestVariant } from '../components/BacktestModal';

interface BotsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_SORT = 'createdAt,desc';

type SelectionMap = Map<number, BotSummary>;

const createSummary = (bot: TradingBot): BotSummary => ({
  id: bot.id,
  name: bot.name,
  exchange: bot.exchange,
  algorithm: bot.algorithm,
  status: bot.status,
  substatus: bot.substatus,
});

const BotsPage = ({ extensionReady }: BotsPageProps) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const sort = DEFAULT_SORT;
  const [data, setData] = useState<BotsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionMap>(new Map());
  const [activeModal, setActiveModal] = useState<BacktestVariant | null>(null);
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

    fetchBots({ page, size: pageSize, sort })
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
      setActiveModal(null);
    }
  }, [extensionReady]);

  const totalSelected = selection.size;
  const bots = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;
  const selectedBotsList = useMemo(() => Array.from(selection.values()), [selection]);

  const currentPageSelectedCount = useMemo(() => {
    if (bots.length === 0) {
      return 0;
    }
    return bots.filter((bot) => selection.has(bot.id)).length;
  }, [bots, selection]);

  const allCurrentSelected = bots.length > 0 && currentPageSelectedCount === bots.length;
  const someCurrentSelected = currentPageSelectedCount > 0 && currentPageSelectedCount < bots.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentSelected;
    }
  }, [someCurrentSelected, allCurrentSelected]);

  const toggleBotSelection = (bot: TradingBot) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(bot.id)) {
        next.delete(bot.id);
      } else {
        next.set(bot.id, createSummary(bot));
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (!checked) {
        bots.forEach((bot) => {
          next.delete(bot.id);
        });
        return next;
      }

      bots.forEach((bot) => {
        next.set(bot.id, createSummary(bot));
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
    setActiveModal(null);
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
        <h1 className="page__title">Боты</h1>
        <p className="page__subtitle">
          Список всех ботов аккаунта veles.finance с пагинацией и возможностью выбора строк.
        </p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение не активно. Откройте UI из расширения, чтобы подгрузить список ботов.
        </div>
      )}

      <div className="panel">
        <div className="panel__header">
          <div className="panel__meta">
            <span className="badge">Всего: {totalElements}</span>
            <span className="badge">Выбрано: {totalSelected}</span>
            <span className="badge">Сортировка: {sort.replace(',', ' ')}</span>
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
                  const isChecked = selection.has(bot.id);
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
          <div>Страница {page + 1} из {Math.max(totalPages, 1)}</div>
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
