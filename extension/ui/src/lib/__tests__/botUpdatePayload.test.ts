import { describe, expect, it } from 'vitest';
import type { BotDepositConfig, BotProfitConfig, BotSettings, TradingBot } from '../../types/bots';
import { buildBotUpdatePayload } from '../botUpdatePayload';

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
  currency: overrides.currency ?? 'USDT',
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
  apiKey: overrides.apiKey !== undefined ? overrides.apiKey : 10,
  substatus: overrides.substatus ?? null,
  symbols: overrides.symbols ?? ['BTC/USDT'],
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
});

describe('buildBotUpdatePayload', () => {
  it('applies overrides and keeps other deposit fields', () => {
    const bot = buildBot({
      id: '77',
      deposit: buildDeposit({ amount: 50, leverage: 1, marginType: 'ISOLATED', currency: 'busd' }),
    });

    const payload = buildBotUpdatePayload(bot, { depositAmount: 200, depositLeverage: 4 });

    expect(payload.id).toBe(77);
    expect(payload.deposit.amount).toBe(200);
    expect(payload.deposit.leverage).toBe(4);
    expect(payload.deposit.marginType).toBe('ISOLATED');
    expect(payload.deposit.currency).toBe('busd');
    expect(payload.profit).not.toBe(bot.profit);
    expect(payload.conditions).not.toBe(bot.conditions);
  });

  it('throws when api key is missing', () => {
    const bot = buildBot({ apiKey: null });

    expect(() => buildBotUpdatePayload(bot, { depositAmount: 10 })).toThrow('API-ключ');
  });

  it('does not mutate source bot', () => {
    const bot = buildBot();

    const payload = buildBotUpdatePayload(bot, { depositLeverage: 10 });

    expect(payload.deposit.leverage).toBe(10);
    expect(bot.deposit.leverage).not.toBe(10);
    expect(payload.symbols).toEqual(bot.symbols);
  });
});
