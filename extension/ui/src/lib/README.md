# `extension/ui/src/lib`

This directory contains shared utilities used across the UI. Every exported helper must be documented here.

## `tableHelpers.ts`
- `resolveSortableNumber(value, fallback?)` – normalises numbers for sorting, replacing `null`/`undefined`/`NaN` with a configurable fallback.
- `buildNumberSorter(selector, fallback?)` – generic sorter factory for AntD tables that compares rows using a numeric selector.
- `formatDurationDays(value, suffix?)` – formats day-based durations with Russian locale rounding and an optional suffix (defaults to `д`).

## `dateTime.ts`
- `MS_IN_SECOND`, `MS_IN_MINUTE`, `MS_IN_HOUR`, `MS_IN_DAY` – base time unit constants in milliseconds.
- `toTimestamp(value)` – safely parses ISO date strings into milliseconds since epoch or returns `null` for invalid inputs.
- `resolvePeriodDays(from, to)` – counts inclusive days between two ISO dates, returning `null` for invalid ranges.

## `backtestAnalytics.ts`
- `calculateMaxDrawdown(values)` – scans an equity series and returns the maximum peak-to-trough drop before a new high.

## `activeDealsHistory.ts`
- `ACTIVE_DEALS_HISTORY_POINT_LIMIT`, `DEAL_HISTORY_WINDOW_MS` – retention constants for stored history (currently only the point cap is enforced).
- `filterDealHistoryByTimeWindow(points, windowMs, now)` – keeps only deal history points newer than `now - windowMs`.
- `isDealHistorySnapshot(value)` / `snapshotHistoryToMap(snapshot)` – runtime validation and conversion helpers for deal history snapshots.
- `mapExecutedOrdersToSnapshot(history)` / `snapshotExecutedOrdersToMap(snapshot)` / `mergeExecutedOrdersHistory(current, incoming, startTimestamp, limit?)` – utilities for validating, storing and deduplicating executed order history with trimming by the earliest chart timestamp.
- `getSeriesStartTimestamp(series)` – returns the earliest timestamp in a portfolio equity series or `null` when empty.
- `createEmptyPortfolioEquitySeries()` / `buildPortfolioEquitySeries(points)` – normalise portfolio equity series with recomputed min/max values.
- `sortPortfolioEquityPoints(points)` – sorts equity points chronologically without mutating the original array.
- `thinTimedPointsFromEnd(points, limit)` – sorts timed points then removes every other entry from the end until the series fits the limit.

## `activeDeals.ts`
- `computeDealMetrics(deal)` – derives exposure, P&L, average/mark prices, executed order counts, and the nearest open averaging order price (BUY for long, SELL for short) for a deal snapshot.
- `aggregateDeals(deals)` – wraps `computeDealMetrics` for a whole collection, returning sorted positions plus aggregate exposure/P&L stats.
- `getDealBaseAsset(deal)` – extracts the base asset ticker from the pair/symbol for UI labels.
- `buildExecutedOrdersIndex(deals)` – collects executed entry/DCA orders per deal into a sorted map alongside a flattened list for chart markers/tooltips.

## `activeDealsZoom.ts`
- `calculateZoomRangeForPreset(series, presetKey)` – builds data zoom bounds using absolute timestamps (startValue/endValue) for the requested trailing window, falling back to full range when not applicable.
- `areZoomRangesEqual(left?, right?)` – compares two zoom ranges by `start`/`end` values.
- `ACTIVE_DEALS_ZOOM_PRESET_OPTIONS` – available preset definitions for the zoom segmented control.
- `isActiveDealsZoomPreset(value)` – runtime guard for persisted preset keys.
