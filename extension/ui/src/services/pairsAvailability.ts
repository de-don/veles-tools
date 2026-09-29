import { fetchPairsAvailability } from '../api/pairsAvailability';

type ListingIndex = Map<string, string>;

const indexCache = new Map<string, Promise<ListingIndex>>();

const normalizeSymbol = (symbol: string): string => symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const loadListingIndex = async (exchange: string): Promise<ListingIndex> => {
  const dictionary = await fetchPairsAvailability(exchange);
  const index: ListingIndex = new Map();
  for (const item of dictionary.payload ?? []) {
    if (item?.symbol && item.availableFrom) {
      index.set(normalizeSymbol(item.symbol), item.availableFrom);
    }
  }
  return index;
};

const getListingIndex = (exchange: string): Promise<ListingIndex> => {
  const cached = indexCache.get(exchange);
  if (cached) {
    return cached;
  }
  const pending = loadListingIndex(exchange);
  indexCache.set(exchange, pending);
  // Do not keep failed lookups so the next launch can retry.
  pending.catch(() => indexCache.delete(exchange));
  return pending;
};

/**
 * Returns the earliest date with candle data for the pair (the start of the "Весь период" preset in Veles),
 * or `null` when it is unknown.
 */
export const getPairListingDate = async (exchange: string, symbol: string): Promise<Date | null> => {
  const index = await getListingIndex(exchange);
  const raw = index.get(normalizeSymbol(symbol));
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resetPairsAvailabilityCache = (): void => {
  indexCache.clear();
};

export type PeriodStartResolution =
  | { kind: 'unchanged'; startISO: string }
  | { kind: 'clamped'; startISO: string }
  | { kind: 'notListed'; listingISO: string };

/** Moves the period start up to the listing date when the requested start is earlier. */
export const clampPeriodStartToListing = (
  startISO: string,
  endISO: string,
  listingDate: Date | null,
): PeriodStartResolution => {
  if (!listingDate) {
    return { kind: 'unchanged', startISO };
  }
  const listingTime = listingDate.getTime();
  if (listingTime >= new Date(endISO).getTime()) {
    return { kind: 'notListed', listingISO: listingDate.toISOString() };
  }
  if (new Date(startISO).getTime() < listingTime) {
    return { kind: 'clamped', startISO: listingDate.toISOString() };
  }
  return { kind: 'unchanged', startISO };
};
