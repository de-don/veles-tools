import { proxyHttpRequest } from '../lib/extensionMessaging';

const BOTS_ENDPOINT = 'https://veles.finance/api/bots';
const BACKTESTS_ENDPOINT = 'https://veles.finance/api/backtests/';

export interface BotStrategyPair {
  exchange?: string | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  symbol?: string | null;
}

export interface BotStrategyCommissions {
  maker?: string | number | null;
  taker?: string | number | null;
}

export interface BotStrategy {
  id: number | null;
  name?: string | null;
  symbol?: string | null;
  symbols?: string[] | null;
  pair?: BotStrategyPair | null;
  exchange?: string | null;
  status?: string | null;
  substatus?: string | null;
  lastFail?: unknown;
  commissions?: BotStrategyCommissions | null;
  useWicks?: boolean | null;
  from?: string | null;
  to?: string | null;
  cursor?: string | null;
  includePosition?: boolean | null;
  public?: boolean | null;
}

export interface BacktestCreateResponse {
  id: number;
  name?: string | null;
  status?: string | null;
}

export interface SymbolDescriptor {
  base: string;
  quote: string;
  display: string;
  pairCode: string;
}

const normalizeCommission = (value: number): string => {
  const fixed = value.toFixed(6);
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
};

const cloneStrategy = (strategy: BotStrategy): BotStrategy => {
  if (typeof structuredClone === 'function') {
    return structuredClone(strategy);
  }
  return JSON.parse(JSON.stringify(strategy)) as BotStrategy;
};

export const fetchBotStrategy = async (botId: number): Promise<BotStrategy> => {
  const response = await proxyHttpRequest<BotStrategy>({
    url: `${BOTS_ENDPOINT}/${botId}`,
    init: {
      method: 'GET',
      credentials: 'include',
    },
  });

  if (!response.ok) {
    const message = response.error ?? `HTTP ${response.status ?? 0}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Пустой ответ при загрузке стратегии бота.');
  }

  return response.body;
};

export const resolveQuoteCurrency = (strategy: BotStrategy): string | null => {
  const direct = strategy?.pair?.to;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim().toUpperCase();
  }

  const primarySymbol = Array.isArray(strategy?.symbols) ? strategy.symbols[0] : strategy?.symbol;
  if (typeof primarySymbol === 'string' && primarySymbol.includes('/')) {
    const parts = primarySymbol.split('/');
    if (parts.length === 2 && parts[1].trim()) {
      return parts[1].trim().toUpperCase();
    }
  }

  const pairSymbol = strategy?.pair?.symbol;
  const baseFrom = strategy?.pair?.from;
  if (typeof pairSymbol === 'string' && typeof baseFrom === 'string') {
    const upperPair = pairSymbol.toUpperCase();
    const upperBase = baseFrom.toUpperCase();
    if (upperPair.startsWith(upperBase)) {
      const remainder = upperPair.slice(upperBase.length);
      if (remainder) {
        return remainder;
      }
    }
  }

  return null;
};

export const composeSymbol = (baseTicker: string, quoteCurrency: string): SymbolDescriptor => {
  const normalizedBase = baseTicker.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!normalizedBase) {
    throw new Error('Некорректный тикер');
  }
  const quote = quoteCurrency.toUpperCase();
  return {
    base: normalizedBase,
    quote,
    display: `${normalizedBase}/${quote}`,
    pairCode: `${normalizedBase}${quote}`,
  };
};

interface BuildPayloadOptions {
  name: string;
  makerCommission: number;
  takerCommission: number;
  includeWicks: boolean;
  isPublic: boolean;
  periodStartISO: string;
  periodEndISO: string;
  overrideSymbol?: SymbolDescriptor;
}

export const buildBacktestPayload = (
  baseStrategy: BotStrategy,
  options: BuildPayloadOptions,
): BotStrategy => {
  const payload = cloneStrategy(baseStrategy);

  payload.id = null;
  payload.name = options.name;

  if (options.overrideSymbol) {
    const { display, base, quote, pairCode } = options.overrideSymbol;
    payload.symbol = display;
    payload.symbols = [display];
    payload.pair = {
      exchange: payload.pair?.exchange ?? payload.exchange ?? null,
      type: payload.pair?.type ?? 'FUTURES',
      from: base,
      to: quote,
      symbol: pairCode,
    };
  } else if (payload.symbol) {
    payload.symbols = [payload.symbol];
  } else if (Array.isArray(payload.symbols) && payload.symbols.length > 0) {
    payload.symbol = payload.symbols[0];
  }

  if (payload.status) {
    payload.status = 'FINISHED';
  }

  if (payload.substatus) {
    delete payload.substatus;
  }

  if (payload.lastFail) {
    delete payload.lastFail;
  }

  payload.commissions = {
    maker: normalizeCommission(options.makerCommission),
    taker: normalizeCommission(options.takerCommission),
  };

  payload.useWicks = Boolean(options.includeWicks);
  payload.from = options.periodStartISO;
  payload.to = options.periodEndISO;
  payload.cursor = null;
  payload.includePosition = true;
  payload.public = Boolean(options.isPublic);

  return payload;
};

export const postBacktest = async (payload: BotStrategy): Promise<BacktestCreateResponse> => {
  const response = await proxyHttpRequest<BacktestCreateResponse>({
    url: BACKTESTS_ENDPOINT,
    init: {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
    },
  });

  if (!response.ok) {
    const message = response.error ?? `HTTP ${response.status ?? 0}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Сервер не вернул данные о созданном бэктесте.');
  }

  return response.body;
};
