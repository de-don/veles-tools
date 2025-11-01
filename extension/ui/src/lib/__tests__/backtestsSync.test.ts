import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backtestsService } from '../../services/backtests';
import {
  clearCachedBacktestList,
  readCachedBacktestIdSet,
  writeCachedBacktestListBatch,
} from '../../storage/backtestCache';
import type { BacktestStatistics } from '../../types/backtests';
import { performBacktestsSync } from '../backtestsSync';

vi.mock('../../services/backtests', () => ({
  backtestsService: {
    getBacktestsList: vi.fn(),
  },
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
    duration: 0,
    profitBase: 0,
    profitQuote: 0,
    netBase: 0,
    netQuote: 0,
    netBasePerDay: 0,
    netQuotePerDay: 0,
    minProfitBase: 0,
    maxProfitBase: 0,
    avgProfitBase: 0,
    minProfitQuote: 0,
    maxProfitQuote: 0,
    avgProfitQuote: 0,
    volume: 0,
    minDuration: 0,
    maxDuration: 0,
    avgDuration: 0,
    profits: 0,
    losses: 0,
    breakevens: 0,
    pullUps: 0,
    winRateProfits: 0,
    winRateLosses: 0,
    totalDeals: 0,
    minGrid: 0,
    maxGrid: 0,
    avgGrid: 0,
    minProfit: 0,
    maxProfit: 0,
    avgProfit: 0,
    mfePercent: 0,
    mfeAbsolute: 0,
    maePercent: 0,
    maeAbsolute: 0,
    commissionBase: 0,
    commissionQuote: 0,
  };
  return { ...base, ...overrides };
};

const getBacktestsListMock = vi.mocked(backtestsService.getBacktestsList);
const readIdsMock = vi.mocked(readCachedBacktestIdSet);
const writeBatchMock = vi.mocked(writeCachedBacktestListBatch);
const clearListMock = vi.mocked(clearCachedBacktestList);

beforeEach(() => {
  vi.clearAllMocks();
  readIdsMock.mockResolvedValue(new Set());
  writeBatchMock.mockResolvedValue();
  clearListMock.mockResolvedValue();
  getBacktestsListMock.mockResolvedValue({
    content: [],
    totalElements: 0,
    totalPages: 0,
    pageNumber: 0,
  });
});

describe('performBacktestsSync', () => {
  it('stores new backtests until общее число записей совпадёт', async () => {
    readIdsMock.mockResolvedValue(new Set([2, 3]));
    const freshFive = buildBacktest(5);
    const freshFour = buildBacktest(4);
    const existingThree = buildBacktest(3);
    const existingTwo = buildBacktest(2);
    getBacktestsListMock.mockResolvedValueOnce({
      content: [freshFive, freshFour, existingThree, existingTwo],
      totalElements: 4,
      totalPages: 1,
      pageNumber: 0,
    });

    const result = await performBacktestsSync();

    expect(result.status).toBe('success');
    expect(result.stored).toBe(2);
    expect(result.processed).toBe(4);
    expect(result.totalRemote).toBe(4);
    expect(writeBatchMock).toHaveBeenCalledWith([freshFive, freshFour]);
    expect(getBacktestsListMock).toHaveBeenCalledTimes(1);
  });

  it('clears local cache when requested', async () => {
    await performBacktestsSync({ clearBeforeSync: true });
    expect(clearListMock).toHaveBeenCalledTimes(1);
  });

  it('marks sync as cancelled when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await performBacktestsSync({ signal: controller.signal });
    expect(result.status).toBe('cancelled');
    expect(writeBatchMock).not.toHaveBeenCalled();
  });

  it('продолжает качать последовательные страницы, пока локальное число меньше удалённого', async () => {
    readIdsMock.mockResolvedValue(new Set([200, 199, 198, 197]));

    const page0Entries = [buildBacktest(200), buildBacktest(199)];
    const page1Entries = [buildBacktest(196), buildBacktest(195)];

    getBacktestsListMock.mockImplementation(async ({ page, size }) => {
      expect(size).toBe(2);
      if (page === 0) {
        return {
          content: page0Entries,
          totalElements: 6,
          totalPages: 3,
          pageNumber: 0,
        };
      }
      if (page === 1) {
        return {
          content: page1Entries,
          totalElements: 6,
          totalPages: 3,
          pageNumber: 1,
        };
      }
      return {
        content: [],
        totalElements: 6,
        totalPages: 3,
        pageNumber: page,
      };
    });

    const result = await performBacktestsSync({ pageSize: 2 });

    const requestedPages = getBacktestsListMock.mock.calls.map(([params]) => params.page);
    expect(requestedPages).toEqual([0, 1]);
    expect(writeBatchMock).toHaveBeenCalledWith(page1Entries);
    expect(result.stored).toBe(2);
    expect(result.status).toBe('success');
  });
});
