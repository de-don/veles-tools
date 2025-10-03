import { describe, it, expect } from 'vitest';
import {
  MS_IN_DAY,
  type BacktestCycle,
  type BacktestStatisticsDetail,
  type BacktestAggregationMetrics,
  computeBacktestMetrics,
  summarizeAggregations,
} from './backtestAggregation';

describe('backtestAggregation', () => {
  describe('MS_IN_DAY constant', () => {
    it('should equal 86400000 milliseconds', () => {
      expect(MS_IN_DAY).toBe(24 * 60 * 60 * 1000);
      expect(MS_IN_DAY).toBe(86400000);
    });
  });

  describe('computeBacktestMetrics', () => {
    it('should compute basic metrics for empty backtest', () => {
      const stats: BacktestStatisticsDetail = {
        id: 1,
        name: 'Test Backtest',
        symbol: 'BTC/USDT',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      };
      const cycles: BacktestCycle[] = [];

      const result = computeBacktestMetrics(stats, cycles);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Backtest');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.pnl).toBe(0);
      expect(result.totalDeals).toBe(0);
      expect(result.profitsCount).toBe(0);
      expect(result.lossesCount).toBe(0);
    });

    it('should compute metrics with finished cycles', () => {
      const stats: BacktestStatisticsDetail = {
        id: 2,
        name: 'Profit Test',
        symbol: 'ETH/USDT',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        netQuote: 125,
        profits: 2,
        losses: 1,
        totalDeals: 3,
        avgDuration: 4200,
        date: '2024-01-01T00:00:00Z',
        algorithm: 'test',
        exchange: 'binance',
        base: 'ETH',
        quote: 'USDT',
        duration: null,
        profitBase: null,
        profitQuote: 125,
        netBase: null,
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
        breakevens: null,
        minGrid: null,
        maxGrid: null,
        avgGrid: null,
        minProfit: null,
        maxProfit: null,
        avgProfit: null,
      };
      const cycles: BacktestCycle[] = [
        {
          id: 1,
          status: 'FINISHED',
          date: '2024-01-10T12:00:00Z',
          duration: 3600,
          netQuote: 100,
          profitQuote: 100,
        },
        {
          id: 2,
          status: 'FINISHED',
          date: '2024-01-15T12:00:00Z',
          duration: 7200,
          netQuote: -50,
          profitQuote: -50,
        },
        {
          id: 3,
          status: 'FINISHED',
          date: '2024-01-20T12:00:00Z',
          duration: 1800,
          netQuote: 75,
          profitQuote: 75,
        },
      ];

      const result = computeBacktestMetrics(stats, cycles);

      expect(result.id).toBe(2);
      expect(result.name).toBe('Profit Test');
      expect(result.symbol).toBe('ETH/USDT');
      expect(result.pnl).toBe(125);
      expect(result.totalDeals).toBe(3);
      expect(result.profitsCount).toBe(2);
      expect(result.lossesCount).toBe(1);
    });

    it('should ignore non-FINISHED cycles', () => {
      const stats: BacktestStatisticsDetail = {
        id: 3,
        name: 'Pending Test',
        symbol: 'BTC/USDT',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        netQuote: 100,
        profits: 1,
        losses: 0,
        totalDeals: 1,
        avgDuration: 3600,
        date: '2024-01-01T00:00:00Z',
        algorithm: 'test',
        exchange: 'binance',
        base: 'BTC',
        quote: 'USDT',
        duration: null,
        profitBase: null,
        profitQuote: 100,
        netBase: null,
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
        breakevens: null,
        minGrid: null,
        maxGrid: null,
        avgGrid: null,
        minProfit: null,
        maxProfit: null,
        avgProfit: null,
      };
      const cycles: BacktestCycle[] = [
        {
          id: 1,
          status: 'FINISHED',
          date: '2024-01-10T12:00:00Z',
          duration: 3600,
          netQuote: 100,
          profitQuote: 100,
        },
        {
          id: 2,
          status: 'RUNNING',
          date: '2024-01-15T12:00:00Z',
          duration: 7200,
          netQuote: 50,
          profitQuote: 50,
        },
        {
          id: 3,
          status: 'PENDING',
          date: '2024-01-20T12:00:00Z',
          duration: 1800,
          netQuote: 25,
          profitQuote: 25,
        },
      ];

      const result = computeBacktestMetrics(stats, cycles);

      expect(result.totalDeals).toBe(1);
      expect(result.pnl).toBe(100);
      expect(result.profitsCount).toBe(1);
      expect(result.lossesCount).toBe(0);
    });

    it('should handle case-insensitive status comparison', () => {
      const stats: BacktestStatisticsDetail = {
        id: 4,
        name: 'Case Test',
        symbol: 'BTC/USDT',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        netQuote: 150,
        profits: 2,
        losses: 0,
        totalDeals: 2,
        avgDuration: 5400,
        date: '2024-01-01T00:00:00Z',
        algorithm: 'test',
        exchange: 'binance',
        base: 'BTC',
        quote: 'USDT',
        duration: null,
        profitBase: null,
        profitQuote: 150,
        netBase: null,
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
        breakevens: null,
        minGrid: null,
        maxGrid: null,
        avgGrid: null,
        minProfit: null,
        maxProfit: null,
        avgProfit: null,
      };
      const cycles: BacktestCycle[] = [
        {
          id: 1,
          status: 'finished',
          date: '2024-01-10T12:00:00Z',
          duration: 3600,
          netQuote: 100,
          profitQuote: 100,
        },
        {
          id: 2,
          status: 'Finished',
          date: '2024-01-15T12:00:00Z',
          duration: 7200,
          netQuote: 50,
          profitQuote: 50,
        },
      ];

      const result = computeBacktestMetrics(stats, cycles);

      expect(result.totalDeals).toBe(2);
      expect(result.pnl).toBe(150);
    });

    it('should calculate average trade duration', () => {
      const stats: BacktestStatisticsDetail = {
        id: 5,
        name: 'Duration Test',
        symbol: 'BTC/USDT',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        netQuote: 150,
        profits: 2,
        losses: 0,
        totalDeals: 2,
        avgDuration: 129600, // 1.5 days in seconds
        date: '2024-01-01T00:00:00Z',
        algorithm: 'test',
        exchange: 'binance',
        base: 'BTC',
        quote: 'USDT',
        duration: null,
        profitBase: null,
        profitQuote: 150,
        netBase: null,
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
        breakevens: null,
        minGrid: null,
        maxGrid: null,
        avgGrid: null,
        minProfit: null,
        maxProfit: null,
        avgProfit: null,
      };
      const cycles: BacktestCycle[] = [
        {
          id: 1,
          status: 'FINISHED',
          date: '2024-01-10T12:00:00Z',
          duration: 86400, // 1 day in seconds
          netQuote: 100,
          profitQuote: 100,
        },
        {
          id: 2,
          status: 'FINISHED',
          date: '2024-01-15T12:00:00Z',
          duration: 172800, // 2 days in seconds
          netQuote: 50,
          profitQuote: 50,
        },
      ];

      const result = computeBacktestMetrics(stats, cycles);

      expect(result.totalDeals).toBe(2);
      expect(result.avgTradeDurationDays).toBeCloseTo(1.5, 1);
    });
  });

  describe('summarizeAggregations', () => {
    it('should return zero summary for empty list', () => {
      const result = summarizeAggregations([]);

      expect(result.totalSelected).toBe(0);
      expect(result.totalPnl).toBe(0);
      expect(result.totalDeals).toBe(0);
      expect(result.totalProfits).toBe(0);
      expect(result.totalLosses).toBe(0);
      expect(result.avgPnlPerDeal).toBe(0);
      expect(result.avgPnlPerBacktest).toBe(0);
    });

    it('should summarize single backtest metrics', () => {
      const metrics: BacktestAggregationMetrics[] = [
        {
          id: 1,
          name: 'Test',
          symbol: 'BTC/USDT',
          pnl: 1000,
          profitsCount: 10,
          lossesCount: 5,
          totalDeals: 15,
          avgTradeDurationDays: 2,
          totalTradeDurationSec: 172800,
          maxDrawdown: 200,
          maxMPU: 50,
          downtimeDays: 10,
          spanStart: Date.now(),
          spanEnd: Date.now() + 86400000,
          activeDurationMs: 86400000,
          equityEvents: [],
          concurrencyIntervals: [],
          riskIntervals: [],
          activeDayIndices: [],
        },
      ];

      const result = summarizeAggregations(metrics);

      expect(result.totalSelected).toBe(1);
      expect(result.totalPnl).toBe(1000);
      expect(result.totalDeals).toBe(15);
      expect(result.totalProfits).toBe(10);
      expect(result.totalLosses).toBe(5);
      expect(result.avgPnlPerDeal).toBeCloseTo(1000 / 15, 2);
      expect(result.avgPnlPerBacktest).toBe(1000);
    });

    it('should aggregate multiple backtest metrics', () => {
      const metrics: BacktestAggregationMetrics[] = [
        {
          id: 1,
          name: 'Test 1',
          symbol: 'BTC/USDT',
          pnl: 1000,
          profitsCount: 10,
          lossesCount: 5,
          totalDeals: 15,
          avgTradeDurationDays: 2,
          totalTradeDurationSec: 172800,
          maxDrawdown: 200,
          maxMPU: 50,
          downtimeDays: 10,
          spanStart: 1000,
          spanEnd: 2000,
          activeDurationMs: 86400000,
          equityEvents: [],
          concurrencyIntervals: [],
          riskIntervals: [],
          activeDayIndices: [0, 1],
        },
        {
          id: 2,
          name: 'Test 2',
          symbol: 'ETH/USDT',
          pnl: 500,
          profitsCount: 8,
          lossesCount: 2,
          totalDeals: 10,
          avgTradeDurationDays: 3,
          totalTradeDurationSec: 259200,
          maxDrawdown: 150,
          maxMPU: 30,
          downtimeDays: 5,
          spanStart: 1500,
          spanEnd: 2500,
          activeDurationMs: 86400000,
          equityEvents: [],
          concurrencyIntervals: [],
          riskIntervals: [],
          activeDayIndices: [1, 2],
        },
      ];

      const result = summarizeAggregations(metrics);

      expect(result.totalSelected).toBe(2);
      expect(result.totalPnl).toBe(1500);
      expect(result.totalDeals).toBe(25);
      expect(result.totalProfits).toBe(18);
      expect(result.totalLosses).toBe(7);
      expect(result.avgPnlPerDeal).toBeCloseTo(1500 / 25, 2);
      expect(result.avgPnlPerBacktest).toBe(750);
    });

    it('should calculate average max drawdown across backtests', () => {
      const metrics: BacktestAggregationMetrics[] = [
        {
          id: 1,
          name: 'Test 1',
          symbol: 'BTC/USDT',
          pnl: 1000,
          profitsCount: 10,
          lossesCount: 5,
          totalDeals: 15,
          avgTradeDurationDays: 2,
          totalTradeDurationSec: 172800,
          maxDrawdown: 200,
          maxMPU: 50,
          downtimeDays: 10,
          spanStart: null,
          spanEnd: null,
          activeDurationMs: 0,
          equityEvents: [],
          concurrencyIntervals: [],
          riskIntervals: [],
          activeDayIndices: [],
        },
        {
          id: 2,
          name: 'Test 2',
          symbol: 'ETH/USDT',
          pnl: 500,
          profitsCount: 8,
          lossesCount: 2,
          totalDeals: 10,
          avgTradeDurationDays: 3,
          totalTradeDurationSec: 259200,
          maxDrawdown: 400,
          maxMPU: 30,
          downtimeDays: 5,
          spanStart: null,
          spanEnd: null,
          activeDurationMs: 0,
          equityEvents: [],
          concurrencyIntervals: [],
          riskIntervals: [],
          activeDayIndices: [],
        },
      ];

      const result = summarizeAggregations(metrics);

      expect(result.avgMaxDrawdown).toBe(300);
    });
  });
});
