import { describe, expect, it } from 'vitest';
import type { BotStrategy } from '../backtestRunner';
import { buildBacktestPayload, composeSymbol, resolveQuoteCurrency } from '../backtestRunner';

const buildStrategy = (overrides: Partial<BotStrategy> = {}): BotStrategy => ({
  id: 'bot-1',
  name: 'Example Strategy',
  symbol: 'BTC/USDT',
  symbols: ['BTC/USDT'],
  pair: {
    exchange: 'BINANCE',
    type: 'FUTURES',
    from: 'BTC',
    to: 'USDT',
    symbol: 'BTCUSDT',
  },
  exchange: 'BINANCE',
  status: 'STARTED',
  substatus: null,
  lastFail: null,
  commissions: {
    maker: '0.001',
    taker: '0.001',
  },
  useWicks: true,
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-02T00:00:00Z',
  cursor: null,
  includePosition: true,
  public: false,
  algorithm: 'demo',
  settings: null,
  ...overrides,
});

describe('resolveQuoteCurrency', () => {
  it('returns direct quote currency when provided', () => {
    const strategy = buildStrategy({
      pair: {
        exchange: 'BINANCE',
        type: 'FUTURES',
        from: 'BTC',
        to: 'usdt',
        symbol: 'BTCUSDT',
      },
    });

    expect(resolveQuoteCurrency(strategy)).toBe('USDT');
  });

  it('derives quote currency from primary symbol when pair information is missing', () => {
    const strategy = buildStrategy({
      pair: null,
      symbols: ['ETH/BUSD'],
      symbol: 'ETH/BUSD',
    });

    expect(resolveQuoteCurrency(strategy)).toBe('BUSD');
  });

  it('infers quote currency from pair symbol and base ticker', () => {
    const strategy = buildStrategy({
      pair: {
        exchange: 'BINANCE',
        type: 'FUTURES',
        from: 'SOL',
        to: null,
        symbol: 'SOLUSDC',
      },
      symbol: null,
      symbols: null,
    });

    expect(resolveQuoteCurrency(strategy)).toBe('USDC');
  });

  it('returns null when quote currency cannot be resolved', () => {
    const strategy = buildStrategy({
      pair: {
        exchange: 'BINANCE',
        type: 'FUTURES',
        from: 'XRP',
        to: null,
        symbol: 'XRP',
      },
      symbol: null,
      symbols: null,
    });

    expect(resolveQuoteCurrency(strategy)).toBeNull();
  });
});

describe('composeSymbol', () => {
  it('normalizes symbol components and produces a descriptor', () => {
    const descriptor = composeSymbol(' eth/ ', 'busd ');

    expect(descriptor).toEqual({
      base: 'ETH',
      quote: 'BUSD',
      display: 'ETH/BUSD',
      pairCode: 'ETHBUSD',
    });
  });

  it('throws when base ticker cannot be normalized', () => {
    expect(() => composeSymbol('@@@', 'USDT')).toThrow('Некорректный тикер');
  });
});

describe('buildBacktestPayload', () => {
  it('builds a payload based on the provided strategy and options', () => {
    const baseStrategy = buildStrategy({
      status: 'STOPPED',
      substatus: 'FAILED',
      lastFail: { message: 'Network error' },
    });
    const overrideSymbol = composeSymbol('ltc', 'usdt');

    const payload = buildBacktestPayload(baseStrategy, {
      name: 'Run 1',
      makerCommission: 0.0005,
      takerCommission: 0.00075,
      includeWicks: false,
      isPublic: true,
      periodStartISO: '2024-01-10T00:00:00Z',
      periodEndISO: '2024-01-11T00:00:00Z',
      overrideSymbol,
    });

    expect(payload).not.toBe(baseStrategy);
    expect(payload.id).toBeNull();
    expect(payload.name).toBe('Run 1');
    expect(payload.symbol).toBe('LTC/USDT');
    expect(payload.symbols).toEqual(['LTC/USDT']);
    expect(payload.pair).toEqual({
      exchange: 'BINANCE',
      type: 'FUTURES',
      from: 'LTC',
      to: 'USDT',
      symbol: 'LTCUSDT',
    });
    expect(payload.status).toBe('FINISHED');
    expect(payload.substatus).toBeUndefined();
    expect(payload.lastFail).toBeUndefined();
    expect(payload.commissions).toEqual({ maker: '0.0005', taker: '0.00075' });
    expect(payload.useWicks).toBe(false);
    expect(payload.from).toBe('2024-01-10T00:00:00Z');
    expect(payload.to).toBe('2024-01-11T00:00:00Z');
    expect(payload.cursor).toBeNull();
    expect(payload.includePosition).toBe(true);
    expect(payload.public).toBe(true);

    // Original strategy remains unchanged
    expect(baseStrategy.symbol).toBe('BTC/USDT');
    expect(baseStrategy.status).toBe('STOPPED');
    expect(baseStrategy.substatus).toBe('FAILED');
    expect(baseStrategy.lastFail).toEqual({ message: 'Network error' });
  });

  it('reuses the original symbol when override is not provided', () => {
    const baseStrategy = buildStrategy({
      symbol: 'ADA/USDT',
      symbols: ['ADA/USDT'],
      pair: {
        exchange: 'BINANCE',
        type: 'FUTURES',
        from: 'ADA',
        to: 'USDT',
        symbol: 'ADAUSDT',
      },
    });

    const payload = buildBacktestPayload(baseStrategy, {
      name: 'Run 2',
      makerCommission: 0.001,
      takerCommission: 0.002,
      includeWicks: true,
      isPublic: false,
      periodStartISO: '2024-02-01T00:00:00Z',
      periodEndISO: '2024-02-02T00:00:00Z',
    });

    expect(payload.symbol).toBe('ADA/USDT');
    expect(payload.symbols).toEqual(['ADA/USDT']);
    expect(payload.pair?.from).toBe('ADA');
    expect(payload.pair?.to).toBe('USDT');
    expect(payload.commissions).toEqual({ maker: '0.001', taker: '0.002' });
  });
});
