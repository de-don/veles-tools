import type { TableProps } from 'antd';
import { Button, Card, Modal, message, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AddToBacktestGroupModal from '../components/backtests/AddToBacktestGroupModal';
import { buildBacktestColumns } from '../components/backtests/backtestTableColumns';
import SaveBacktestGroupModal from '../components/backtests/SaveBacktestGroupModal';
import PageHeader from '../components/ui/PageHeader';
import SelectionSummaryBar from '../components/ui/SelectionSummaryBar';
import { TableColumnSettingsButton } from '../components/ui/TableColumnSettingsButton';
import { useBacktestGroups } from '../context/BacktestGroupsContext';
import { BacktestsSyncProvider, useBacktestsSync } from '../context/BacktestsSyncContext';
import { useTableColumnSettings } from '../lib/useTableColumnSettings';
import type { BacktestStatistics } from '../types/backtests';

interface BacktestsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const countFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

const formatCountValue = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return countFormatter.format(value);
};

const getBacktestsNoun = (count: number): string => {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) {
    return 'бэктестов';
  }
  if (last === 1) {
    return 'бэктест';
  }
  if (last >= 2 && last <= 4) {
    return 'бэктеста';
  }
  return 'бэктестов';
};

const BacktestsPageContent = ({ extensionReady }: BacktestsPageProps) => {
  const { backtests, backtestsLoading, localCount, isSyncRunning, startSync, autoSyncPending } = useBacktestsSync();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { groups, createGroup, appendToGroup } = useBacktestGroups();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [saveGroupModalOpen, setSaveGroupModalOpen] = useState(false);
  const [addToGroupModalOpen, setAddToGroupModalOpen] = useState(false);
  const [selectionDetailsOpen, setSelectionDetailsOpen] = useState(false);

  const backtestsById = useMemo(() => {
    const map = new Map<number, BacktestStatistics>();
    backtests.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [backtests]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => backtestsById.has(id));
      if (next.length === prev.length) {
        return prev;
      }
      return next;
    });
  }, [backtestsById]);

  const selectedBacktests = useMemo(() => {
    return selectedIds.map((id) => backtestsById.get(id)).filter((item): item is BacktestStatistics => Boolean(item));
  }, [backtestsById, selectedIds]);

  const filteredBacktests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return backtests;
    }
    return backtests.filter((item) => item.name.toLowerCase().includes(query));
  }, [backtests, searchTerm]);

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredBacktests.length / pageSize) - 1, 0);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredBacktests.length, page, pageSize]);

  useEffect(() => {
    void searchTerm;
    setPage(0);
  }, [searchTerm]);
  useEffect(() => {
    if (!extensionReady) {
      setSelectedIds([]);
    }
  }, [extensionReady]);

  const totalElements = filteredBacktests.length;
  const totalSelected = selectedBacktests.length;

  useEffect(() => {
    if (totalSelected === 0 && selectionDetailsOpen) {
      setSelectionDetailsOpen(false);
    }
  }, [totalSelected, selectionDetailsOpen]);

  const handleOpenSaveGroup = useCallback(() => {
    if (selectedIds.length === 0) {
      messageApi.warning('Выберите бэктесты для сохранения в группу.');
      return;
    }
    setSaveGroupModalOpen(true);
  }, [messageApi, selectedIds]);

  const handleOpenAddToGroup = useCallback(() => {
    if (selectedIds.length === 0) {
      messageApi.warning('Выберите бэктесты для добавления в группу.');
      return;
    }
    if (groups.length === 0) {
      messageApi.info('Сначала создайте хотя бы одну группу.');
      return;
    }
    setAddToGroupModalOpen(true);
  }, [groups, messageApi, selectedIds]);

  const handleSaveGroupSubmit = useCallback(
    (groupName: string) => {
      if (selectedIds.length === 0) {
        messageApi.error('Нет выбранных бэктестов для сохранения.');
        return;
      }
      const result = createGroup(groupName, selectedIds);
      if (!result) {
        messageApi.error('Не удалось сохранить группу. Проверьте название и выбранные бэктесты.');
        return;
      }
      messageApi.success(`Группа «${result.name}» сохранена.`);
      setSaveGroupModalOpen(false);
    },
    [createGroup, messageApi, selectedIds],
  );

  const handleAddToGroupSubmit = useCallback(
    (groupId: string) => {
      if (selectedIds.length === 0) {
        messageApi.error('Нет выбранных бэктестов для добавления.');
        return;
      }
      const current = groups.find((group) => group.id === groupId) ?? null;
      const result = appendToGroup(groupId, selectedIds);
      if (!result) {
        messageApi.error('Не удалось обновить группу.');
        return;
      }
      if (current && current.backtestIds.length === result.backtestIds.length) {
        messageApi.info(`Все выбранные бэктесты уже есть в группе «${result.name}».`);
      } else {
        messageApi.success(`Бэктесты добавлены в группу «${result.name}».`);
      }
      setAddToGroupModalOpen(false);
    },
    [appendToGroup, groups, messageApi, selectedIds],
  );

  const handleCloseSaveGroup = useCallback(() => {
    setSaveGroupModalOpen(false);
  }, []);

  const handleCloseAddToGroup = useCallback(() => {
    setAddToGroupModalOpen(false);
  }, []);

  const selectedRowKeys = selectedIds;

  const rowSelection: TableRowSelection<BacktestStatistics> = {
    selectedRowKeys,
    type: 'checkbox',
    preserveSelectedRowKeys: true,
    onChange: (nextSelectedRowKeys) => {
      setSelectedIds(nextSelectedRowKeys.map((key) => Number(key)));
    },
  };

  const handleManualSync = useCallback(() => {
    void startSync();
  }, [startSync]);

  const syncReady = !(backtestsLoading || isSyncRunning || autoSyncPending);

  const handleTableChange = useCallback<NonNullable<TableProps<BacktestStatistics>['onChange']>>(
    (pagination) => {
      const nextPageSize = pagination?.pageSize ?? pageSize;
      const pageIndex = Math.max((pagination?.current ?? 1) - 1, 0);
      const isPageSizeChanged = nextPageSize !== pageSize;

      if (isPageSizeChanged) {
        setPageSize(nextPageSize);
        setPage(0);
      } else {
        setPage(pageIndex);
      }
    },
    [pageSize],
  );

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const baseTableColumns: ColumnsType<BacktestStatistics> = useMemo(buildBacktestColumns, []);

  const {
    columns: backtestColumns,
    settings: backtestColumnSettings,
    moveColumn: moveBacktestColumn,
    setColumnVisibility: setBacktestColumnVisibility,
    reset: resetBacktestColumns,
    hasCustomSettings: backtestsHasCustomSettings,
  } = useTableColumnSettings<BacktestStatistics>({
    tableKey: 'backtests-table',
    columns: baseTableColumns,
  });

  const tablePagination = useMemo(
    () => ({
      current: page + 1,
      pageSize,
      total: totalElements,
      showSizeChanger: true,
      pageSizeOptions: PAGE_SIZE_OPTIONS.map((option) => String(option)),
      showTotal: (total: number, range: [number, number]) => `${range[0]}–${range[1]} из ${total}`,
    }),
    [page, pageSize, totalElements],
  );

  return (
    <section className="page">
      {messageContextHolder}
      <PageHeader
        title="Бэктесты"
        description={`Локально сохранено: ${formatCountValue(localCount)}`}
        extra={
          <Button type="primary" onClick={handleManualSync} loading={isSyncRunning} disabled={backtestsLoading}>
            Синхронизировать
          </Button>
        }
      />

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение Veles Tools неактивно. Локальные данные доступны, но синхронизация и загрузка деталей недоступны.
        </div>
      )}

      {!syncReady && (
        <Card>
          <div className="panel__body">Синхронизируем локальную базу бэктестов…</div>
        </Card>
      )}

      {syncReady && (
        <>
          <Card>
            <div className="panel__section">
              <div
                className="panel__actions"
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <input
                  type="search"
                  className="input"
                  placeholder="Поиск по названию"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{ flexGrow: 1, minWidth: 200, maxWidth: 360 }}
                />
                <div style={{ marginLeft: 'auto' }}>
                  <TableColumnSettingsButton
                    settings={backtestColumnSettings}
                    moveColumn={moveBacktestColumn}
                    setColumnVisibility={setBacktestColumnVisibility}
                    reset={resetBacktestColumns}
                    hasCustomSettings={backtestsHasCustomSettings}
                  />
                </div>
              </div>
              {totalSelected > 0 ? (
                <SelectionSummaryBar
                  message={
                    <>
                      Выбрано {totalSelected}{' '}
                      <Button type="link" size="small" onClick={() => setSelectionDetailsOpen(true)}>
                        {getBacktestsNoun(totalSelected)}
                      </Button>
                    </>
                  }
                  actions={
                    <>
                      <Button type="primary" onClick={handleOpenSaveGroup}>
                        Сохранить как группу
                      </Button>
                      <Button
                        onClick={handleOpenAddToGroup}
                        disabled={groups.length === 0}
                        title={groups.length === 0 ? 'Нет доступных групп' : undefined}
                      >
                        Добавить в группу
                      </Button>
                    </>
                  }
                />
              ) : null}
              <div className="table-container">
                <Table<BacktestStatistics>
                  columns={backtestColumns}
                  dataSource={filteredBacktests}
                  rowKey={(item) => item.id}
                  pagination={tablePagination}
                  rowSelection={rowSelection}
                  loading={backtestsLoading}
                  onChange={handleTableChange}
                  scroll={{ x: 1400 }}
                  size="middle"
                  locale={{
                    emptyText: backtestsLoading ? 'Загружаем локальные данные…' : 'Нет данных для отображения.',
                  }}
                  sticky
                />
              </div>
            </div>
          </Card>

          <SaveBacktestGroupModal
            open={saveGroupModalOpen}
            selectedBacktests={selectedBacktests}
            onCancel={handleCloseSaveGroup}
            onSubmit={handleSaveGroupSubmit}
          />
          <AddToBacktestGroupModal
            open={addToGroupModalOpen}
            groups={groups}
            selectedBacktests={selectedBacktests}
            onCancel={handleCloseAddToGroup}
            onSubmit={handleAddToGroupSubmit}
          />
          <Modal
            title={`Выбрано ${totalSelected} ${getBacktestsNoun(totalSelected)}`}
            open={selectionDetailsOpen}
            onCancel={() => setSelectionDetailsOpen(false)}
            footer={null}
            width={560}
          >
            {selectedBacktests.length === 0 ? (
              <Typography.Text type="secondary">Список пуст — выберите бэктесты в таблице.</Typography.Text>
            ) : (
              <ul className="panel__list--compact" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {selectedBacktests.map((item) => (
                  <li key={item.id}>
                    <span className="chip">
                      <strong>{item.name}</strong>
                      <span>
                        <a
                          href={`https://veles.finance/cabinet/backtests/${item.id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          ID: {item.id}
                        </a>
                        {' · '}
                        {item.symbol}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
          {totalSelected === 0 ? (
            <Typography.Text type="secondary">
              Выберите бэктесты, чтобы сохранить в группу или добавить в существующую.
            </Typography.Text>
          ) : null}
        </>
      )}
    </section>
  );
};

const BacktestsPage = ({ extensionReady }: BacktestsPageProps) => {
  return (
    <BacktestsSyncProvider extensionReady={extensionReady}>
      <BacktestsPageContent extensionReady={extensionReady} />
    </BacktestsSyncProvider>
  );
};

export default BacktestsPage;
