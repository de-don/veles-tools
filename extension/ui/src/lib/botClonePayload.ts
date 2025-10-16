import type { CreateBotPayload } from '../api/bots';
import type { SymbolDescriptor } from '../api/backtestRunner';
import type { BacktestDepositConfig, BacktestSettings } from '../types/backtests';
import type { TradingBot } from '../types/bots';

export interface BotCloneOverrides {
  apiKeyId: number;
  name: string;
  depositAmount: number;
  depositLeverage: number;
  marginType: string | null;
  depositCurrency: string | null;
  profitCurrency: string | null;
}

const deepClone = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fallback to JSON clone
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const normalizeCurrency = (value: string | null | undefined, fallback: string | null): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed.toUpperCase();
    }
  }
  if (typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed.length > 0) {
      return trimmed.toUpperCase();
    }
  }
  return null;
};

const normalizeMarginType = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.toUpperCase();
};

export const buildBotClonePayload = (
  bot: TradingBot,
  descriptor: SymbolDescriptor,
  overrides: BotCloneOverrides,
): CreateBotPayload => {
  const depositCurrency = normalizeCurrency(overrides.depositCurrency, descriptor.quote);
  const profitCurrency = normalizeCurrency(overrides.profitCurrency, descriptor.quote);
  const marginType = normalizeMarginType(overrides.marginType ?? bot.deposit?.marginType ?? null);

  const clonedProfit = bot.profit ? deepClone(bot.profit) : null;
  const normalizedProfitCurrency = profitCurrency ?? descriptor.quote;
  if (clonedProfit) {
    clonedProfit.currency = normalizedProfitCurrency;
  }

  const clonedConditions = bot.conditions ? deepClone(bot.conditions) : null;
  const includePosition =
    typeof bot.settings?.includePosition === 'boolean' ? bot.settings.includePosition : null;

  const depositConfig: BacktestDepositConfig = {
    amount: overrides.depositAmount,
    leverage: overrides.depositLeverage,
    marginType,
  };

  const resolvedDepositCurrency = depositCurrency ?? descriptor.quote;
  if (resolvedDepositCurrency) {
    depositConfig.currency = resolvedDepositCurrency;
  }

  const settingsPayload: BacktestSettings = bot.settings
    ? (deepClone(bot.settings) as unknown as BacktestSettings)
    : null;

  return {
    id: null,
    apiKey: overrides.apiKeyId,
    name: overrides.name,
    symbol: descriptor.display,
    symbols: [descriptor.display],
    exchange: bot.exchange,
    algorithm: bot.algorithm,
    pullUp: bot.pullUp ?? null,
    portion: bot.portion ?? null,
    profit: clonedProfit,
    deposit: depositConfig,
    settings: settingsPayload,
    conditions: clonedConditions,
    from: null,
    to: null,
    status: 'STOPPED',
    commissions: null,
    public: null,
    useWicks: null,
    cursor: null,
    includePosition: includePosition ?? true,
  };
};
