import { describe, expect, it } from 'vitest';
import type { BotDepositConfig, BotProfitConfig, BotSettings, TradingBot } from '../../types/bots';
import { buildBotUpdatePayload } from '../botUpdatePayload';

const buildProfit = (overrides: Partial<BotProfitConfig> = {}): BotProfitConfig => ({
  type: overrides.type ?? 'PERCENT',
  currency: overrides.currency ?? 'USDT',
  checkPnl: overrides.checkPnl ?? null,
  conditionGroups: overrides.conditionGroups ?? null,
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
  conditionGroups:
    'conditionGroups' in overrides
      ? overrides.conditionGroups
      : [
          [
            {
              type: 'OPERATION',
              left: { type: 'INDICATOR', indicator: 'ROC', timeFrame: 1, method: 'CLOSE', shift: 0, length: 9 },
              operator: 'LESS',
              right: { type: 'CONSTANT', value: 0 },
            },
          ],
        ],
  conditions: 'conditions' in overrides ? overrides.conditions : undefined,
  status: overrides.status ?? 'RUNNING',
  apiKey: overrides.apiKey !== undefined ? overrides.apiKey : 10,
  substatus: overrides.substatus ?? null,
  symbols: overrides.symbols ?? ['BTC/USDT'],
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  termination: overrides.termination ?? null,
  dealsLeft: overrides.dealsLeft ?? null,
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
    expect(payload.conditionGroups).not.toBe(bot.conditionGroups);
  });

  it('preserves the "stop after N deals" termination setting', () => {
    const bot = buildBot({ termination: 5 });

    const payload = buildBotUpdatePayload(bot, { depositAmount: 200 });

    expect(payload.termination).toBe(5);
  });

  it('passes through legacy flat conditions unchanged when the bot has no conditionGroups', () => {
    const legacyConditions = [
      {
        type: 'INDICATOR',
        indicator: 'ROC',
        interval: 'ONE_MINUTE',
        basic: false,
        value: -0.5,
        operation: 'LESS',
        closed: true,
        reverse: false,
      },
    ];
    const bot = buildBot({ conditionGroups: null, conditions: legacyConditions });

    const payload = buildBotUpdatePayload(bot, { depositAmount: 200 });

    expect(payload.conditions).toEqual(legacyConditions);
    expect(payload.conditions).not.toBe(legacyConditions);
    expect(payload.conditionGroups).toBeUndefined();
  });

  it('does not send marketplace metadata fields the source bot never had', () => {
    const bot = buildBot();

    const payload = buildBotUpdatePayload(bot, { depositAmount: 200 });

    expect(payload.forBeginners).toBeUndefined();
    expect(payload.new).toBeUndefined();
    expect(payload.hot).toBeUndefined();
    expect(payload.categories).toBeUndefined();
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
