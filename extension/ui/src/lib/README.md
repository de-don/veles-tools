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
- `DEAL_HISTORY_LIMIT`, `DEAL_HISTORY_WINDOW_MS`, `ACTIVE_DEALS_HISTORY_RETENTION_MS` – retention constants for per-deal history and portfolio series (3 days for the latter).
- `filterDealHistoryByTimeWindow(points, windowMs, now)` – keeps only history points newer than `now - windowMs`.
- `clampDealHistory(points, limit?)` – trims history to the most recent `limit` entries to cap memory usage.
- `mapHistoryToSnapshot(history, limit?)` / `snapshotHistoryToMap(snapshot)` – convert history maps to storage-friendly records and back with validation.
- `isDealHistorySnapshot(value)` – runtime guard that ensures a parsed snapshot matches the expected schema.
