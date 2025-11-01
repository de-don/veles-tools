import { describe, expect, it } from 'vitest';
import type { SymbolDescriptor } from '../../api/backtestRunner';
import type { BotDepositConfig, BotProfitConfig, BotSettings, TradingBot } from '../../types/bots';
import { buildBotClonePayload } from '../botClonePayload';

const buildProfit = (overrides: Partial<BotProfitConfig> = {}): BotProfitConfig => ({
  type: overrides.type ?? 'PERCENT',
  currency: overrides.currency ?? 'USDT',
  checkPnl: overrides.checkPnl ?? null,
  conditions: overrides.conditions ?? null,
});

const buildDeposit = (overrides: Partial<BotDepositConfig> = {}): BotDepositConfig => ({
  amount: overrides.amount ?? 100,
  leverage: overrides.leverage ?? 5,
  marginType: overrides.marginType ?? 'CROSS',
});

const buildSettings = (overrides: Partial<BotSettings> = {}): BotSettings => ({
  type: overrides.type ?? 'GRID',
  baseOrder: overrides.baseOrder ?? null,
  orders: overrides.orders ?? null,
  indentType: overrides.indentType ?? null,
  includePosition: overrides.includePosition ?? true,
});

const buildBot = (overrides: Partial<TradingBot> = {}): TradingBot => ({
  id: overrides.id ?? 42,
  name: overrides.name ?? 'Base Bot',
  exchange: overrides.exchange ?? 'BYBIT_FUTURES',
  algorithm: overrides.algorithm ?? 'LONG',
  pullUp: overrides.pullUp ?? null,
  portion: overrides.portion ?? null,
  profit: overrides.profit ?? buildProfit(),
  deposit: overrides.deposit ?? buildDeposit(),
  stopLoss: overrides.stopLoss ?? null,
  settings: overrides.settings ?? buildSettings(),
  conditions: overrides.conditions ?? [
    {
      type: 'GT',
      indicator: null,
      interval: null,
      basic: null,
      value: null,
      operation: null,
      closed: null,
      reverse: null,
    },
  ],
  status: overrides.status ?? 'RUNNING',
  apiKey: overrides.apiKey ?? 10,
  substatus: overrides.substatus ?? null,
  symbols: overrides.symbols ?? ['BTC/USDT'],
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
});

describe('buildBotClonePayload', () => {
  it('normalizes currencies and margin type with fallbacks', () => {
    const bot = buildBot({
      profit: buildProfit({ currency: 'busd' }),
      deposit: buildDeposit({ marginType: 'isolated' }),
    });
    const descriptor: SymbolDescriptor = {
      base: 'ETH',
      quote: 'USDT',
      display: 'ETH/USDT',
      pairCode: 'ETHUSDT',
    };

    const payload = buildBotClonePayload(bot, descriptor, {
      apiKeyId: 77,
      name: 'ETH clone',
      depositAmount: 200,
      depositLeverage: 3,
      marginType: 'cross',
      depositCurrency: null,
      profitCurrency: null,
    });

    expect(payload.apiKey).toBe(77);
    expect(payload.id).toBeNull();
    expect(payload.termination).toBeNull();
    expect(payload.symbols).toEqual(['ETH/USDT']);
    expect(payload.deposit?.marginType).toBe('CROSS');
    expect(payload.deposit?.currency).toBe('USDT');
    expect(payload.profit?.currency).toBe('USDT');
  });

  it('preserves includePosition flag from original settings', () => {
    const bot = buildBot({ settings: buildSettings({ includePosition: false }) });
    const descriptor: SymbolDescriptor = {
      base: 'SOL',
      quote: 'USDT',
      display: 'SOL/USDT',
      pairCode: 'SOLUSDT',
    };

    const payload = buildBotClonePayload(bot, descriptor, {
      apiKeyId: 5,
      name: 'SOL clone',
      depositAmount: 150,
      depositLeverage: 2,
      marginType: null,
      depositCurrency: 'sol',
      profitCurrency: 'busd',
    });

    expect(payload.deposit?.currency).toBe('SOL');
    expect(payload.profit?.currency).toBe('BUSD');
    expect(payload.id).toBeNull();
  });

  it('returns deep copies so original bot stays untouched', () => {
    const bot = buildBot();
    const descriptor: SymbolDescriptor = {
      base: 'ADA',
      quote: 'USDT',
      display: 'ADA/USDT',
      pairCode: 'ADAUSDT',
    };

    const payload = buildBotClonePayload(bot, descriptor, {
      apiKeyId: 9,
      name: 'ADA clone',
      depositAmount: 120,
      depositLeverage: 4,
      marginType: null,
      depositCurrency: null,
      profitCurrency: null,
    });

    expect(payload.profit).not.toBe(bot.profit);
    expect(payload.conditions).not.toBe(bot.conditions);
    expect(bot.profit?.currency).toBe('USDT');
    expect(payload.id).toBeNull();
  });

  it('applies override flags when provided', () => {
    const bot = buildBot({ symbols: [] });
    const descriptor: SymbolDescriptor = {
      base: 'APT',
      quote: 'USDT',
      display: 'APT/USDT',
      pairCode: 'APTUSDT',
    };

    const payload = buildBotClonePayload(bot, descriptor, {
      apiKeyId: 99,
      name: 'APT clone',
      depositAmount: 300,
      depositLeverage: 6,
      marginType: null,
      depositCurrency: null,
      profitCurrency: null,
      symbols: ['APT/USDT', ''],
    });

    expect(payload.symbols).toEqual(['APT/USDT']);
    expect(payload.apiKey).toBe(99);
    expect(payload.id).toBeNull();
  });
});
