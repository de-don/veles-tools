export interface PairAvailabilityDto {
  /** Pair in `BASE/QUOTE` form, e.g. `BTC/USDT`. */
  symbol: string;
  /** Earliest date with candle data (listing date); the "Весь период" preset in Veles starts here. */
  availableFrom: string | null;
}

export interface PairsAvailabilityDictionaryDto {
  checksum: string;
  payload: PairAvailabilityDto[];
}
