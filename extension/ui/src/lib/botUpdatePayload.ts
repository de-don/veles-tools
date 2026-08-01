import type { UpdateBotPayload } from '../api/bots';
import type { BotDepositConfigDto, BotProfitConfigDto, BotSettingsDto, BotStopLossConfigDto } from '../api/bots.dtos';
import type { TradingBot } from '../types/bots';

export interface BotUpdateOverrides {
  depositAmount?: number;
  depositLeverage?: number;
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

const normalizeBotId = (value: TradingBot['id']): number => {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    throw new Error('Некорректный идентификатор бота.');
  }

  const trimmed = value.trim();
  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    throw new Error('Некорректный идентификатор бота.');
  }

  return parsed;
};

export const buildBotUpdatePayload = (bot: TradingBot, overrides: BotUpdateOverrides): UpdateBotPayload => {
  if (bot.apiKey === null || bot.apiKey === undefined) {
    throw new Error(`У бота ${bot.name} отсутствует API-ключ.`);
  }

  const depositAmount = overrides.depositAmount ?? bot.deposit.amount;
  const depositLeverage = overrides.depositLeverage ?? bot.deposit.leverage;

  const deposit: BotDepositConfigDto = {
    ...(deepClone(bot.deposit) as BotDepositConfigDto),
    amount: depositAmount,
    leverage: depositLeverage,
  };

  const profit: BotProfitConfigDto | null = bot.profit ? deepClone(bot.profit) : null;
  // The bot uses either the new conditionGroups tree or the legacy flat conditions list — never both.
  // Pass through whichever is present rather than force-converting to the other format.
  const conditionGroups = bot.conditionGroups ? deepClone(bot.conditionGroups) : undefined;
  const conditions = bot.conditions ? deepClone(bot.conditions) : undefined;
  const settings: BotSettingsDto | null = bot.settings ? deepClone(bot.settings) : null;
  const stopLoss: BotStopLossConfigDto | null = bot.stopLoss ? deepClone(bot.stopLoss) : null;

  const symbols = Array.isArray(bot.symbols) ? [...bot.symbols] : [];

  return {
    algorithm: bot.algorithm,
    apiKey: bot.apiKey,
    conditionGroups,
    conditions,
    deposit,
    exchange: bot.exchange,
    id: normalizeBotId(bot.id),
    name: bot.name,
    portion: bot.portion ?? null,
    profit,
    pullUp: bot.pullUp ?? null,
    settings,
    stopLoss,
    symbols,
    termination: bot.termination ?? null,
    // Marketplace flags are platform-assigned; only echo them back if the source bot actually had them,
    // never send an explicit null that would wipe a flag we never actually read.
    forBeginners: bot.forBeginners,
    new: bot.new,
    hot: bot.hot,
    categories: bot.categories ? deepClone(bot.categories) : bot.categories,
  };
};
