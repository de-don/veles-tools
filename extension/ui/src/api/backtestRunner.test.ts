import { describe, it, expect } from 'vitest';
import {
  resolveQuoteCurrency,
  composeSymbol,
  buildBacktestPayload,
  type BotStrategy,
  type SymbolDescriptor,
} from './backtestRunner';

describe('backtestRunner', () => {
  describe('resolveQuoteCurrency', () => {
    it('should extract quote currency from pair.to', () => {
      const strategy: BotStrategy = {
        id: 1,
        pair: {
          to: 'USDT',
        },
      };
      expect(resolveQuoteCurrency(strategy)).toBe('USDT');
    });

    it('should trim and uppercase pair.to', () => {
      const strategy: BotStrategy = {
        id: 1,
        pair: {
          to: '  usdt  ',
        },
      };
      expect(resolveQuoteCurrency(strategy)).toBe('USDT');
    });

    it('should extract quote from primary symbol with slash', () => {
      const strategy: BotStrategy = {
        id: 1,
        symbol: 'BTC/USDT',
      };
      expect(resolveQuoteCurrency(strategy)).toBe('USDT');
    });

    it('should extract quote from symbols array', () => {
      const strategy: BotStrategy = {
        id: 1,
        symbols: ['ETH/BTC', 'BTC/USDT'],
      };
      expect(resolveQuoteCurrency(strategy)).toBe('BTC');
    });

    it('should derive quote from pair.symbol minus pair.from', () => {
      const strategy: BotStrategy = {
        id: 1,
        pair: {
          symbol: 'BTCUSDT',
          from: 'BTC',
        },
      };
      expect(resolveQuoteCurrency(strategy)).toBe('USDT');
    });

    it('should return null when no quote currency can be determined', () => {
      const strategy: BotStrategy = {
        id: 1,
      };
      expect(resolveQuoteCurrency(strategy)).toBeNull();
    });

    it('should return null for invalid symbol format', () => {
      const strategy: BotStrategy = {
        id: 1,
        symbol: 'BTCUSDT',
      };
      expect(resolveQuoteCurrency(strategy)).toBeNull();
    });
  });

  describe('composeSymbol', () => {
    it('should compose symbol from base and quote', () => {
      const result = composeSymbol('BTC', 'USDT');
      expect(result).toEqual({
        base: 'BTC',
        quote: 'USDT',
        display: 'BTC/USDT',
        pairCode: 'BTCUSDT',
      });
    });

    it('should normalize base ticker to uppercase', () => {
      const result = composeSymbol('btc', 'USDT');
      expect(result.base).toBe('BTC');
    });

    it('should normalize quote to uppercase', () => {
      const result = composeSymbol('BTC', 'usdt');
      expect(result.quote).toBe('USDT');
    });

    it('should remove special characters from base ticker', () => {
      const result = composeSymbol('BTC-USD', 'USDT');
      expect(result.base).toBe('BTCUSD');
    });

    it('should throw error for empty base ticker', () => {
      expect(() => composeSymbol('', 'USDT')).toThrow('Некорректный тикер');
    });

    it('should throw error for base ticker with only special characters', () => {
      expect(() => composeSymbol('---', 'USDT')).toThrow('Некорректный тикер');
    });
  });

  describe('buildBacktestPayload', () => {
    const baseStrategy: BotStrategy = {
      id: 123,
      name: 'Original Strategy',
      symbol: 'BTC/USDT',
      symbols: ['BTC/USDT'],
      pair: {
        exchange: 'binance',
        type: 'FUTURES',
        from: 'BTC',
        to: 'USDT',
        symbol: 'BTCUSDT',
      },
      status: 'RUNNING',
      substatus: 'ACTIVE',
      lastFail: { error: 'test' },
      commissions: {
        maker: 0.0002,
        taker: 0.0004,
      },
      useWicks: false,
      from: '2024-01-01T00:00:00Z',
      to: '2024-12-31T23:59:59Z',
      cursor: 'some-cursor',
      includePosition: false,
      public: false,
    };

    const options = {
      name: 'Test Backtest',
      makerCommission: 0.001,
      takerCommission: 0.002,
      includeWicks: true,
      isPublic: false,
      periodStartISO: '2025-01-01T00:00:00Z',
      periodEndISO: '2025-06-30T23:59:59Z',
    };

    it('should set id to null', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.id).toBeNull();
    });

    it('should set name from options', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.name).toBe('Test Backtest');
    });

    it('should set status to FINISHED when present', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.status).toBe('FINISHED');
    });

    it('should remove substatus', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.substatus).toBeUndefined();
    });

    it('should remove lastFail', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.lastFail).toBeUndefined();
    });

    it('should normalize commissions', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.commissions).toEqual({
        maker: '0.001',
        taker: '0.002',
      });
    });

    it('should handle commission with trailing zeros', () => {
      const customOptions = {
        ...options,
        makerCommission: 0.0001,
        takerCommission: 0.00015,
      };
      const result = buildBacktestPayload(baseStrategy, customOptions);
      expect(result.commissions).toEqual({
        maker: '0.0001',
        taker: '0.00015',
      });
    });

    it('should set useWicks from options', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.useWicks).toBe(true);
    });

    it('should set period dates from options', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.from).toBe('2025-01-01T00:00:00Z');
      expect(result.to).toBe('2025-06-30T23:59:59Z');
    });

    it('should set cursor to null', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.cursor).toBeNull();
    });

    it('should set includePosition to true', () => {
      const result = buildBacktestPayload(baseStrategy, options);
      expect(result.includePosition).toBe(true);
    });

    it('should set public from options', () => {
      const publicOptions = { ...options, isPublic: true };
      const result = buildBacktestPayload(baseStrategy, publicOptions);
      expect(result.public).toBe(true);
    });

    it('should override symbol when overrideSymbol is provided', () => {
      const overrideSymbol: SymbolDescriptor = {
        base: 'ETH',
        quote: 'BTC',
        display: 'ETH/BTC',
        pairCode: 'ETHBTC',
      };
      const customOptions = { ...options, overrideSymbol };
      const result = buildBacktestPayload(baseStrategy, customOptions);

      expect(result.symbol).toBe('ETH/BTC');
      expect(result.symbols).toEqual(['ETH/BTC']);
      expect(result.pair).toEqual({
        exchange: 'binance',
        type: 'FUTURES',
        from: 'ETH',
        to: 'BTC',
        symbol: 'ETHBTC',
      });
    });

    it('should use FUTURES as default pair type when overriding symbol', () => {
      const strategyWithoutPair: BotStrategy = {
        ...baseStrategy,
        pair: null,
        exchange: 'kraken',
      };
      const overrideSymbol: SymbolDescriptor = {
        base: 'ETH',
        quote: 'BTC',
        display: 'ETH/BTC',
        pairCode: 'ETHBTC',
      };
      const customOptions = { ...options, overrideSymbol };
      const result = buildBacktestPayload(strategyWithoutPair, customOptions);

      expect(result.pair?.type).toBe('FUTURES');
      expect(result.pair?.exchange).toBe('kraken');
    });

    it('should set symbols from symbol when no overrideSymbol and symbol exists', () => {
      const strategyWithoutSymbols: BotStrategy = {
        ...baseStrategy,
        symbols: null,
      };
      const result = buildBacktestPayload(strategyWithoutSymbols, options);
      expect(result.symbols).toEqual(['BTC/USDT']);
    });

    it('should set symbol from symbols array when no overrideSymbol and no symbol', () => {
      const strategyWithoutSymbol: BotStrategy = {
        ...baseStrategy,
        symbol: null,
        symbols: ['ETH/USDT', 'BTC/USDT'],
      };
      const result = buildBacktestPayload(strategyWithoutSymbol, options);
      expect(result.symbol).toBe('ETH/USDT');
    });

    it('should not modify original strategy object', () => {
      const originalId = baseStrategy.id;
      const originalName = baseStrategy.name;
      buildBacktestPayload(baseStrategy, options);
      expect(baseStrategy.id).toBe(originalId);
      expect(baseStrategy.name).toBe(originalName);
    });
  });
});
