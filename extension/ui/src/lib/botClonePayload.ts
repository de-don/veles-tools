import type { SymbolDescriptor } from '../api/backtestRunner';
import type { CreateBotPayload } from '../api/bots';
import type {
  BotDepositConfigDto,
  BotProfitConfigDto,
  BotSettingsDto,
  BotStopLossConfigDto,
  StrategyConditionDto,
} from '../api/bots.dtos';
import type { BotDepositConfig, TradingBot } from '../types/bots';

export interface BotCloneOverrides {
  apiKeyId: number;
  name: string;
  depositAmount: number;
  depositLeverage: number;
  marginType: BotDepositConfig['marginType'] | null;
  depositCurrency: string | null;
  profitCurrency: string | null;
  symbols?: string[] | null;
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

export const buildBotClonePayload = (
  bot: TradingBot,
  descriptor: SymbolDescriptor,
  overrides: BotCloneOverrides,
): CreateBotPayload => {
  const profitCurrency = normalizeCurrency(overrides.profitCurrency, descriptor.quote);
  const marginType = overrides.marginType ?? bot.deposit.marginType;

  const clonedProfit = bot.profit ? deepClone(bot.profit) : null;
  const normalizedProfitCurrency = profitCurrency ?? descriptor.quote;
  if (clonedProfit) {
    clonedProfit.currency = normalizedProfitCurrency;
  }
  const normalizedDepositCurrency = normalizeCurrency(overrides.depositCurrency, bot.deposit.currency ?? null);

  const clonedConditions: StrategyConditionDto[] = bot.conditions ? deepClone(bot.conditions) : [];
  const clonedStopLoss: BotStopLossConfigDto | null = bot.stopLoss
    ? (deepClone(bot.stopLoss) as BotStopLossConfigDto)
    : null;

  const depositConfig: BotDepositConfigDto = {
    amount: overrides.depositAmount,
    leverage: overrides.depositLeverage,
    marginType,
    currency: normalizedDepositCurrency,
  };

  const settingsPayload: BotSettingsDto = deepClone(bot.settings);

  const profit: BotProfitConfigDto = clonedProfit ?? {
    type: 'ABSOLUTE',
    currency: normalizedProfitCurrency ?? '',
    checkPnl: null,
    conditions: null,
  };

  const resolvedSymbols = (() => {
    if (Array.isArray(overrides.symbols)) {
      return overrides.symbols
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
    }
    const descriptorSymbol = descriptor.display;
    if (descriptorSymbol && descriptorSymbol.trim().length > 0) {
      return [descriptorSymbol.trim()];
    }
    if (bot.symbols && bot.symbols.length > 0) {
      return deepClone(bot.symbols);
    }
    return [];
  })();

  return {
    algorithm: bot.algorithm,
    apiKey: overrides.apiKeyId,
    conditions: clonedConditions,
    deposit: depositConfig,
    exchange: bot.exchange,
    id: null,
    name: overrides.name,
    portion: bot.portion ?? null,
    profit,
    pullUp: bot.pullUp ?? null,
    settings: settingsPayload,
    stopLoss: clonedStopLoss,
    symbols: resolvedSymbols,
    termination: null,
  };
};
