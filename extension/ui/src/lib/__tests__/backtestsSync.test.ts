import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBacktests } from '../../api/backtests';
import {
  clearCachedBacktestList,
  readCachedBacktestIdSet,
  writeCachedBacktestListBatch,
} from '../../storage/backtestCache';
import type { BacktestStatistics } from '../../types/backtests';
import { performBacktestsSync } from '../backtestsSync';

vi.mock('../../api/backtests', () => ({
  fetchBacktests: vi.fn(),
}));

vi.mock('../../storage/backtestCache', () => ({
  readCachedBacktestIdSet: vi.fn(),
  writeCachedBacktestListBatch: vi.fn(),
  clearCachedBacktestList: vi.fn(),
}));

const buildBacktest = (id: number, overrides: Partial<BacktestStatistics> = {}): BacktestStatistics => {
  const base: BacktestStatistics = {
    id,
    name: `Backtest ${id}`,
    date: '2024-01-01T00:00:00Z',
    from: '2024-01-01T00:00:00Z',
    to: '2024-01-02T00:00:00Z',
    algorithm: 'sample',
    exchange: 'BYBIT',
    symbol: 'BTCUSDT',
    base: 'BTC',
    quote: 'USDT',
    duration: null,
    profitBase: null,
    profitQuote: null,
    netBase: null,
    netQuote: null,
    netBasePerDay: null,
    netQuotePerDay: null,
    minProfitBase: null,
    maxProfitBase: null,
    avgProfitBase: null,
    minProfitQuote: null,
    maxProfitQuote: null,
    avgProfitQuote: null,
    volume: null,
    minDuration: null,
    maxDuration: null,
    avgDuration: null,
    profits: null,
    losses: null,
    breakevens: null,
    pullUps: null,
    winRateProfits: null,
    winRateLosses: null,
    totalDeals: null,
    minGrid: null,
    maxGrid: null,
    avgGrid: null,
    minProfit: null,
    maxProfit: null,
    avgProfit: null,
    mfePercent: null,
    mfeAbsolute: null,
    maePercent: null,
    maeAbsolute: null,
    commissionBase: null,
    commissionQuote: null,
    deposit: null,
  };
  return { ...base, ...overrides };
};

const fetchBacktestsMock = vi.mocked(fetchBacktests);
const readIdsMock = vi.mocked(readCachedBacktestIdSet);
const writeBatchMock = vi.mocked(writeCachedBacktestListBatch);
const clearListMock = vi.mocked(clearCachedBacktestList);

beforeEach(() => {
  vi.clearAllMocks();
  readIdsMock.mockResolvedValue(new Set());
  writeBatchMock.mockResolvedValue();
  clearListMock.mockResolvedValue();
  fetchBacktestsMock.mockResolvedValue({
    content: [],
    totalElements: 0,
    totalPages: 0,
    pageNumber: 0,
  });
});

describe('performBacktestsSync', () => {
  it('stores new backtests and stops when все записи синхронизированы (incremental)', async () => {
    readIdsMock.mockResolvedValue(new Set([2, 3]));
    const freshFive = buildBacktest(5);
    const freshFour = buildBacktest(4);
    const existingThree = buildBacktest(3);
    const existingTwo = buildBacktest(2);
    fetchBacktestsMock.mockResolvedValueOnce({
      content: [freshFive, freshFour, existingThree, existingTwo],
      totalElements: 4,
      totalPages: 1,
      pageNumber: 0,
    });

    const result = await performBacktestsSync({ mode: 'incremental' });

    expect(result.status).toBe('success');
    expect(result.stopReason).toBe('existing');
    expect(result.stored).toBe(2);
    expect(result.processed).toBe(4);
    expect(writeBatchMock).toHaveBeenCalledWith([freshFive, freshFour]);
    expect(fetchBacktestsMock).toHaveBeenCalledTimes(1);
  });

  it('clears local cache when requested', async () => {
    await performBacktestsSync({ clearBeforeSync: true, mode: 'incremental' });
    expect(clearListMock).toHaveBeenCalledTimes(1);
  });

  it('marks sync as cancelled when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await performBacktestsSync({ signal: controller.signal, mode: 'incremental' });
    expect(result.status).toBe('cancelled');
    expect(writeBatchMock).not.toHaveBeenCalled();
  });

  it('skips already синхронизированные страницы, когда локальных записей меньше (full)', async () => {
    readIdsMock.mockResolvedValue(new Set([200, 199, 198, 197]));

    const page0Entries = [buildBacktest(200), buildBacktest(199)];
    const page2Entries = [buildBacktest(196), buildBacktest(195)];

    fetchBacktestsMock.mockImplementation(async ({ page, size }) => {
      expect(size).toBe(2);
      if (page === 0) {
        return {
          content: page0Entries,
          totalElements: 6,
          totalPages: 3,
          pageNumber: 0,
        };
      }
      if (page === 2) {
        return {
          content: page2Entries,
          totalElements: 6,
          totalPages: 3,
          pageNumber: 2,
        };
      }
      return {
        content: [],
        totalElements: 6,
        totalPages: 3,
        pageNumber: page,
      };
    });

    const result = await performBacktestsSync({ pageSize: 2, mode: 'full' });

    const requestedPages = fetchBacktestsMock.mock.calls.map(([params]) => params.page);
    expect(requestedPages).toEqual([0, 2]);
    expect(writeBatchMock).toHaveBeenCalledWith(page2Entries);
    expect(result.stored).toBe(2);
    expect(result.status).toBe('success');
    expect(result.stopReason).toBe('exhausted');
  });
});
