import { parseNumericInput } from './numericInput';

// Limits mirror the Veles bot editor (Deposit component).
export const REINVEST_MIN_PERCENT = 0.5;
export const REINVEST_DEFAULT_PERCENT = 20;
export const REINVEST_MAX_PERCENT_SPOT = 100;
export const REINVEST_MAX_PERCENT_FUTURES = 50;

/** Veles exchange ids: spot is `BINANCE` / `*_SPOT`, derivatives are `*_FUTURES`. */
export const isFuturesExchange = (exchange: string | null | undefined): boolean => {
  return typeof exchange === 'string' && exchange.toUpperCase().includes('FUTURES');
};

/** Upper reinvest bound shared by all given exchanges; the stricter futures limit wins when mixed or unknown. */
export const resolveReinvestMaxPercent = (exchanges: ReadonlyArray<string | null | undefined>): number => {
  if (exchanges.length === 0 || exchanges.some(isFuturesExchange)) {
    return REINVEST_MAX_PERCENT_FUTURES;
  }
  return REINVEST_MAX_PERCENT_SPOT;
};

/** Veles treats any non-null percent as "reinvest enabled". */
export const isReinvestEnabled = (value: number | null | undefined): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const formatReinvestInput = (value: number | null | undefined): string => {
  return isReinvestEnabled(value) ? String(value) : '';
};

export const formatReinvestRange = (maxPercent: number): string => {
  return `${String(REINVEST_MIN_PERCENT).replace('.', ',')}–${maxPercent}%`;
};

export type ReinvestParseResult = { ok: true; value: number | null } | { ok: false; error: string };

/** Converts the form state into the `deposit.reinvest` value (`null` when disabled). */
export const parseReinvestInput = (enabled: boolean, raw: string, maxPercent: number): ReinvestParseResult => {
  if (!enabled) {
    return { ok: true, value: null };
  }
  const value = parseNumericInput(raw);
  if (value === null || value < REINVEST_MIN_PERCENT || value > maxPercent) {
    return { ok: false, error: `Реинвест должен быть в диапазоне ${formatReinvestRange(maxPercent)}.` };
  }
  return { ok: true, value };
};
