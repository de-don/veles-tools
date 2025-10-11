import type { CreateBotPayload } from '../api/bots';
import type {
  BacktestDepositConfig,
  BacktestStatisticsDetail,
} from '../types/backtests';

export interface BotCreationOverrides {
  apiKeyId: number;
  depositAmount: number;
  depositLeverage: number;
  marginType: string;
}

const sanitizeMarginType = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return normalized;
};

const buildDepositConfig = (
  detailDeposit: BacktestDepositConfig | undefined | null,
  overrides: BotCreationOverrides,
): BacktestDepositConfig => {
  const normalizedMarginType = sanitizeMarginType(overrides.marginType)
    ?? (typeof detailDeposit?.marginType === 'string' ? detailDeposit.marginType : null);
  const currency =
    typeof detailDeposit?.currency === 'string' && detailDeposit.currency.trim().length > 0
      ? detailDeposit.currency.trim()
      : null;

  return {
    amount: overrides.depositAmount,
    leverage: overrides.depositLeverage,
    marginType: normalizedMarginType,
    currency,
  };
};

const deriveSymbols = (detail: BacktestStatisticsDetail): string[] | null => {
  if (Array.isArray(detail.symbols) && detail.symbols.length > 0) {
    return detail.symbols;
  }
  if (typeof detail.symbol === 'string' && detail.symbol.trim().length > 0) {
    return [detail.symbol.trim()];
  }
  if (detail.base && detail.quote) {
    return [`${detail.base}/${detail.quote}`];
  }
  return null;
};

export const buildBotCreationPayload = (
  detail: BacktestStatisticsDetail,
  overrides: BotCreationOverrides,
): CreateBotPayload => {
  const symbols = deriveSymbols(detail);
  const deposit = buildDepositConfig(detail.deposit ?? null, overrides);
  const name = typeof detail.name === 'string' && detail.name.trim().length > 0
    ? detail.name.trim()
    : `Backtest ${detail.id}`;
  const symbol =
    typeof detail.symbol === 'string' && detail.symbol.trim().length > 0
      ? detail.symbol.trim()
      : symbols && symbols.length > 0
        ? symbols[0]
        : null;

  return {
    id: null,
    name,
    symbol,
    exchange: detail.exchange ?? null,
    algorithm: detail.algorithm ?? null,
    pullUp: detail.pullUp ?? null,
    portion: detail.portion ?? null,
    profit: detail.profit ?? null,
    deposit,
    settings: detail.settings ?? null,
    conditions: detail.conditions ?? null,
    from: detail.from ?? detail.start ?? null,
    to: detail.to ?? detail.end ?? null,
    status: detail.status ?? 'FINISHED',
    commissions: detail.commissions ?? null,
    public: detail.public ?? null,
    useWicks: detail.useWicks ?? null,
    cursor: detail.cursor ?? null,
    includePosition: detail.includePosition ?? true,
    symbols,
    apiKey: overrides.apiKeyId,
  };
};
