import type { TableProps } from 'antd';
import { Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import type { Key, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { formatAmount, formatDateRu, formatLeverage, formatPercent } from '../../lib/backtestFormatting';
import { buildCabinetUrl } from '../../lib/cabinetUrls';
import { resolvePeriodDays } from '../../lib/dateTime';
import { buildNumberSorter, formatDurationDays } from '../../lib/tableHelpers';
import { useTableColumnSettings } from '../../lib/useTableColumnSettings';
import type { BacktestInfo } from '../../types/backtestInfos';
import { TableColumnSettingsButton } from '../ui/TableColumnSettingsButton';

interface BacktestInfoTableProps {
  data: BacktestInfo[];
  loading: boolean;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  actions?: ReactNode;
}

const COLUMN_WIDTH = 200;
const COLUMN_MIN_WIDTH = 150;

const applyColumnSizing = (columns: ColumnsType<BacktestInfo>): ColumnsType<BacktestInfo> => {
  return columns.map((column) => ({
    ...column,
    width: COLUMN_WIDTH,
    onCell: column.onCell ?? (() => ({ style: { minWidth: COLUMN_MIN_WIDTH } })),
  }));
};

const buildColumns = (): ColumnsType<BacktestInfo> =>
  applyColumnSizing([
    {
      title: 'Бэктест',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 260,
      sorter: (a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }),
      render: (_value, item) => (
        <div>
          <div>{item.name}</div>
          <div className="panel__description">
            ID{' '}
            <a href={buildCabinetUrl(`backtests/${item.id}`)} target="_blank" rel="noreferrer noopener">
              {item.id}
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Биржа',
      dataIndex: 'exchange',
      key: 'exchange',
      width: 200,
      sorter: (a, b) => a.exchange.localeCompare(b.exchange, 'ru', { sensitivity: 'base' }),
      render: (_value, item) => (
        <div>
          <div>{item.exchange}</div>
          <div className="panel__description">{item.symbol}</div>
        </div>
      ),
    },
    {
      title: 'Монета',
      dataIndex: 'symbol',
      key: 'symbol',
      sorter: (a, b) => a.symbol.localeCompare(b.symbol, 'ru', { sensitivity: 'base' }),
    },
    {
      title: 'Период',
      dataIndex: 'period',
      key: 'period',
      width: 200,
      sorter: buildNumberSorter((item) => resolvePeriodDays(item.from, item.to)),
      render: (_value, item) => {
        const days = resolvePeriodDays(item.from, item.to);
        return (
          <div>
            <div>{formatDurationDays(days)}</div>
            <div className="panel__description">
              {formatDateRu(item.from)} — {formatDateRu(item.to)}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Депозит',
      dataIndex: 'depositAmount',
      key: 'deposit',
      width: 200,
      sorter: buildNumberSorter((item) => item.depositAmount),
      render: (_value, item) => formatAmount(item.depositAmount, item.depositCurrency ?? item.quote),
    },
    {
      title: 'Плечо',
      dataIndex: 'leverage',
      key: 'leverage',
      width: 200,
      sorter: buildNumberSorter((item) => item.leverage),
      render: (_value, item) => formatLeverage(item.leverage),
    },
    {
      title: 'Win rate',
      dataIndex: 'winRatePercent',
      key: 'winRate',
      width: 200,
      sorter: buildNumberSorter((item) => item.winRatePercent),
      render: (_value, item) => formatPercent(item.winRatePercent),
    },
    {
      title: 'P&L',
      dataIndex: 'profitNet',
      key: 'pnl',
      width: 200,
      sorter: buildNumberSorter((item) => item.profitNet),
      render: (_value, item) => formatAmount(item.profitNet, item.quote),
    },
    {
      title: 'P&L / МПУ',
      dataIndex: 'pnlMaeRatio',
      key: 'pnlMaeRatio',
      width: 200,
      sorter: buildNumberSorter((item) => item.pnlMaeRatio),
      render: (_value, item) => formatAmount(item.pnlMaeRatio),
    },
    {
      title: 'Net / день',
      dataIndex: 'netQuotePerDay',
      key: 'netPerDay',
      width: 200,
      sorter: buildNumberSorter((item) => item.netQuotePerDay),
      render: (_value, item) => formatAmount(item.netQuotePerDay, item.quote),
    },
    {
      title: 'Макс. просадка',
      dataIndex: 'maxDrawdownQuote',
      key: 'maxDrawdown',
      width: 200,
      sorter: buildNumberSorter((item) => item.maxDrawdownQuote),
      render: (_value, item) => formatAmount(item.maxDrawdownQuote, item.quote),
    },
    {
      title: 'Акт. МПУ',
      dataIndex: 'activeMaeAbsolute',
      key: 'activeMae',
      width: 200,
      sorter: buildNumberSorter((item) => item.activeMaeAbsolute),
      render: (_value, item) => formatAmount(item.activeMaeAbsolute, item.quote),
    },
    {
      title: 'Сделки (P/L)',
      dataIndex: 'profits',
      key: 'deals',
      width: 200,
      sorter: buildNumberSorter((item) => item.profitableDeals + item.losingDeals),
      render: (_value, item) => (
        <span>
          {item.profitableDeals} / {item.losingDeals}
        </span>
      ),
    },
    {
      title: 'Ср. длительность',
      dataIndex: 'averageDurationDays',
      key: 'avgDuration',
      width: 200,
      sorter: buildNumberSorter((item) => item.averageDurationDays),
      render: (_value, item) => formatDurationDays(item.averageDurationDays),
    },
    {
      title: 'Торговых дней',
      dataIndex: 'tradingDays',
      key: 'tradingDays',
      width: 200,
      sorter: buildNumberSorter((item) => item.tradingDays),
      render: (_value, item) => (item.tradingDays > 0 ? `${item.tradingDays}` : '—'),
    },
    {
      title: 'Макс МПУ',
      dataIndex: 'maxMaeAbsolute',
      key: 'maxMae',
      width: 200,
      sorter: buildNumberSorter((item) => item.maxMaeAbsolute),
      render: (_value, item) => formatAmount(item.maxMaeAbsolute, item.quote),
    },
    {
      title: 'Макс МПП',
      dataIndex: 'maxMfeAbsolute',
      key: 'maxMfe',
      width: 200,
      sorter: buildNumberSorter((item) => item.maxMfeAbsolute),
      render: (_value, item) => formatAmount(item.maxMfeAbsolute, item.quote),
    },
    {
      title: 'Ср. МПУ',
      dataIndex: 'avgMaeAbsolute',
      key: 'avgMae',
      width: 200,
      sorter: buildNumberSorter((item) => item.avgMaeAbsolute),
      render: (_value, item) => formatAmount(item.avgMaeAbsolute, item.quote),
    },
    {
      title: 'Ср. МПП',
      dataIndex: 'avgMfeAbsolute',
      key: 'avgMfe',
      width: 200,
      sorter: buildNumberSorter((item) => item.avgMfeAbsolute),
      render: (_value, item) => formatAmount(item.avgMfeAbsolute, item.quote),
    },
  ]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 10000];

const BacktestInfoTable = ({ data, loading, selectedIds, onSelectionChange, actions }: BacktestInfoTableProps) => {
  const baseColumns = useMemo(buildColumns, []);

  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 100,
    showSizeChanger: true,
    hideOnSinglePage: false,
    pageSizeOptions: PAGE_SIZE_OPTIONS.map((option) => String(option)),
  });

  const { columns, settings, moveColumn, setColumnVisibility, reset, hasCustomSettings } =
    useTableColumnSettings<BacktestInfo>({
      tableKey: 'backtest-info-table',
      columns: baseColumns,
      minimumVisibleColumns: 3,
    });

  useEffect(() => {
    const pageSize = pagination.pageSize ?? PAGE_SIZE_OPTIONS[2];
    const totalPages = Math.max(1, Math.ceil(Math.max(data.length, 1) / pageSize));
    const current = pagination.current ?? 1;
    if (current > totalPages) {
      setPagination((prev) => ({ ...prev, current: totalPages }));
    }
  }, [data.length, pagination.current, pagination.pageSize]);

  const mergedPagination = useMemo<TablePaginationConfig>(
    () => ({
      ...pagination,
      total: data.length,
    }),
    [data.length, pagination],
  );

  const handleTableChange: TableProps<BacktestInfo>['onChange'] = (nextPagination) => {
    const current = nextPagination?.current ?? pagination.current ?? 1;
    const pageSize = nextPagination?.pageSize ?? pagination.pageSize ?? PAGE_SIZE_OPTIONS[2];
    setPagination((prev) => ({
      ...prev,
      current,
      pageSize,
    }));
  };

  const rowSelection = useMemo<TableRowSelection<BacktestInfo>>(() => {
    return {
      selectedRowKeys: selectedIds,
      onChange: (keys: Key[]) => {
        const normalizedIds = keys.map((key) => Number(key));
        onSelectionChange(normalizedIds);
      },
      type: 'checkbox',
      preserveSelectedRowKeys: true,
    };
  }, [selectedIds, onSelectionChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>{actions}</div>
        <TableColumnSettingsButton
          settings={settings}
          moveColumn={moveColumn}
          setColumnVisibility={setColumnVisibility}
          reset={reset}
          hasCustomSettings={hasCustomSettings}
          minimumVisibleColumns={3}
        />
      </div>
      <Table
        rowKey={(item) => item.id}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={mergedPagination}
        onChange={handleTableChange}
        rowSelection={rowSelection}
        scroll={{ x: true }}
        size="small"
      />
    </div>
  );
};

export default BacktestInfoTable;
