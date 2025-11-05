import type { CreateBotPayload } from '../api/bots';
import type { BotDepositConfigDto, BotProfitConfigDto } from '../api/bots.dtos';
import type { BacktestDetail } from '../types/backtests';

export interface BotCreationOverrides {
  apiKeyId: number;
  depositAmount: number;
  depositLeverage: number;
  marginType: string;
  symbols?: string[] | null;
}

const sanitizeMarginType = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return normalized;
};

const buildDepositConfig = (
  detailDeposit: BotDepositConfigDto,
  overrides: BotCreationOverrides,
): BotDepositConfigDto => {
  const normalizedMarginType =
    sanitizeMarginType(overrides.marginType) ??
    (typeof detailDeposit.marginType === 'string' ? detailDeposit.marginType : null);
  const currency =
    typeof detailDeposit.currency === 'string' && detailDeposit.currency.trim().length > 0
      ? detailDeposit.currency.trim()
      : null;

  return {
    amount: overrides.depositAmount,
    leverage: overrides.depositLeverage,
    marginType: normalizedMarginType,
    currency,
  };
};

const deriveSymbols = (detail: BacktestDetail): string | null => {
  const configSymbol = detail.config.symbol;
  if (typeof configSymbol === 'string' && configSymbol.trim().length > 0) {
    return configSymbol.trim();
  }
  const statsSymbol = detail.statistics.symbol;
  if (statsSymbol.trim().length > 0) {
    return statsSymbol.trim();
  }
  const { base, quote } = detail.statistics;
  if (base && quote) {
    return `${base}/${quote}`;
  }
  return null;
};

const clonePayloadFragment = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fallback to JSON cloning
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const buildBotCreationPayload = (detail: BacktestDetail, overrides: BotCreationOverrides): CreateBotPayload => {
  const stats = detail.statistics;
  const config = detail.config;

  const deposit = buildDepositConfig(config.deposit, overrides);

  const name = config.name;
  const exchange = config.exchange;
  const algorithm = config.algorithm;
  const pullUp = config.pullUp;
  const portion = config.portion;

  const profit: BotProfitConfigDto = config.profit
    ? clonePayloadFragment(config.profit)
    : {
        type: 'ABSOLUTE',
        currency: stats.quote,
        checkPnl: null,
        conditions: null,
      };

  const settings = clonePayloadFragment(config.settings);
  const conditions = clonePayloadFragment(config.conditions);
  const stopLoss = clonePayloadFragment(config.stopLoss);

  const resolvedSymbols = (() => {
    if (Array.isArray(overrides.symbols)) {
      return overrides.symbols
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
    }
    const derivedSymbol = deriveSymbols(detail);
    return derivedSymbol ? [derivedSymbol] : [];
  })();

  return {
    algorithm,
    apiKey: overrides.apiKeyId,
    conditions,
    deposit,
    exchange,
    id: null,
    name,
    portion,
    profit,
    pullUp,
    settings,
    stopLoss,
    symbols: resolvedSymbols,
    termination: null,
  };
};
