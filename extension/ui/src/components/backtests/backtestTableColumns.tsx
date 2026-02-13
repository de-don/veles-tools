import type { ColumnsType } from 'antd/es/table';
import {
  formatAmount,
  formatDateRu,
  formatDurationMinutes,
  formatPercent,
  resolveDealCount,
} from '../../lib/backtestFormatting';
import { buildCabinetUrl } from '../../lib/cabinetUrls';
import { buildDateSorter, buildNumberSorter, buildStringSorter } from '../../lib/tableHelpers';
import type { BacktestStatistics } from '../../types/backtests';

const buildColumns = (): ColumnsType<BacktestStatistics> => [
  {
    title: 'Название',
    dataIndex: 'name',
    key: 'name',
    width: 240,
    fixed: 'left',
    sorter: buildStringSorter((item) => item.name ?? ''),
    render: (_value, item) => (
      <div>
        <div>{item.name}</div>
        <div className="panel__description">
          ID:{' '}
          <a href={buildCabinetUrl(`backtests/${item.id}`)} target="_blank" rel="noreferrer noopener">
            {item.id}
          </a>
        </div>
      </div>
    ),
  },
  {
    title: 'Период',
    dataIndex: 'date',
    key: 'date',
    sorter: buildDateSorter((item) => item.from ?? item.date ?? null),
    render: (_value, item) => (
      <div>
        <div>{formatDateRu(item.from)}</div>
        <div className="panel__description">до {formatDateRu(item.to)}</div>
      </div>
    ),
  },
  {
    title: 'Биржа',
    dataIndex: 'exchange',
    key: 'exchange',
    sorter: buildStringSorter((item) => item.exchange),
  },
  {
    title: 'Пара',
    dataIndex: 'symbol',
    key: 'symbol',
    sorter: buildStringSorter((item) => item.symbol),
    render: (_value, item) => (
      <div>
        <div>{item.symbol}</div>
        <div className="panel__description">{item.algorithm}</div>
      </div>
    ),
  },
  {
    title: 'Прибыль',
    dataIndex: 'profitQuote',
    key: 'profitQuote',
    sorter: buildNumberSorter((item) => item.profitQuote),
    render: (_value, item) => (
      <div>
        <div>{formatAmount(item.profitQuote, item.quote)}</div>
        <div className="panel__description">Base: {formatAmount(item.profitBase, item.base)}</div>
      </div>
    ),
  },
  {
    title: 'Net / день',
    dataIndex: 'netQuote',
    key: 'netQuote',
    sorter: buildNumberSorter((item) => item.netQuotePerDay),
    render: (_value, item) => (
      <div>
        <div>{formatAmount(item.netQuote, item.quote)}</div>
        <div className="panel__description">в день: {formatAmount(item.netQuotePerDay, item.quote)}</div>
      </div>
    ),
  },
  {
    title: 'Число сделок',
    dataIndex: 'totalDeals',
    key: 'totalDeals',
    sorter: buildNumberSorter((item) => item.totalDeals),
    render: (_value, item) => (
      <div>
        <div>{item.totalDeals ?? '—'}</div>
        <div className="panel__description">
          P/L/B: {item.profits ?? 0}/{item.losses ?? 0}/{item.breakevens ?? 0}
        </div>
      </div>
    ),
  },
  {
    title: 'Win rate',
    dataIndex: 'winRateProfits',
    key: 'winRate',
    sorter: buildNumberSorter((item) => {
      const winsCount = resolveDealCount(item.winRateProfits ?? item.profits);
      const lossesCount = resolveDealCount(item.winRateLosses ?? item.losses);
      const completedDeals = winsCount + lossesCount;
      if (completedDeals <= 0) {
        return null;
      }
      return (winsCount / completedDeals) * 100;
    }),
    render: (_value, item) => {
      const winRateValue = item.winRateProfits ?? item.profits ?? 0;
      const lossRateValue = item.winRateLosses ?? item.losses ?? 0;
      const total = winRateValue + lossRateValue;
      if (total <= 0) {
        return (
          <div>
            <div>—</div>
            <div className="panel__description">Loss: —</div>
          </div>
        );
      }
      const winPercent = (winRateValue / total) * 100;
      const lossPercent = (lossRateValue / total) * 100;
      return (
        <div>
          <div>{formatPercent(winPercent)}</div>
          <div className="panel__description">Loss: {formatPercent(lossPercent)}</div>
        </div>
      );
    },
  },
  {
    title: 'МПУ',
    dataIndex: 'maeAbsolute',
    key: 'maeAbsolute',
    sorter: buildNumberSorter((item) => item.maeAbsolute),
    render: (_value, item) => (
      <div>
        <div>{formatAmount(item.maeAbsolute, item.quote)}</div>
        <div className="panel__description">{formatPercent(item.maePercent)}</div>
      </div>
    ),
  },
  {
    title: 'МПП',
    dataIndex: 'mfeAbsolute',
    key: 'mfeAbsolute',
    sorter: buildNumberSorter((item) => item.mfeAbsolute),
    render: (_value, item) => (
      <div>
        <div>{formatAmount(item.mfeAbsolute, item.quote)}</div>
        <div className="panel__description">{formatPercent(item.mfePercent)}</div>
      </div>
    ),
  },
  {
    title: 'Макс время в сделке',
    dataIndex: 'maxDuration',
    key: 'maxDuration',
    sorter: buildNumberSorter((item) => item.maxDuration),
    render: (_value, item) => formatDurationMinutes(item.maxDuration),
  },
  {
    title: 'Среднее время в сделке',
    dataIndex: 'avgDuration',
    key: 'avgDuration',
    sorter: buildNumberSorter((item) => item.avgDuration),
    render: (_value, item) => formatDurationMinutes(item.avgDuration),
  },
];

export const buildBacktestColumns = (): ColumnsType<BacktestStatistics> => buildColumns();
