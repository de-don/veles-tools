import type { DataZoomRange } from './chartOptions';
import type { PortfolioEquitySeries } from './deprecatedFile';

export type ActiveDealsZoomPresetKey = 'lastHour' | 'last4Hours' | 'lastDay' | 'all';
export type ActiveDealsZoomPreset = ActiveDealsZoomPresetKey | 'custom';

export interface ActiveDealsZoomPresetDefinition {
  key: ActiveDealsZoomPresetKey;
  label: string;
  durationMs?: number;
}

const HOUR_IN_MS = 60 * 60 * 1000;

const PRESETS: Record<ActiveDealsZoomPresetKey, ActiveDealsZoomPresetDefinition> = {
  lastHour: {
    key: 'lastHour',
    label: '1 час',
    durationMs: HOUR_IN_MS,
  },
  last4Hours: {
    key: 'last4Hours',
    label: '4 часа',
    durationMs: 4 * HOUR_IN_MS,
  },
  lastDay: {
    key: 'lastDay',
    label: '24 часа',
    durationMs: 24 * HOUR_IN_MS,
  },
  all: {
    key: 'all',
    label: 'Все время',
  },
};

export const ACTIVE_DEALS_ZOOM_PRESET_OPTIONS: ActiveDealsZoomPresetDefinition[] = [
  PRESETS.lastHour,
  PRESETS.last4Hours,
  PRESETS.lastDay,
  PRESETS.all,
];

const clampToPercent = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
};

const findStartIndex = (series: PortfolioEquitySeries, durationMs: number, latestTimestamp: number): number => {
  const threshold = latestTimestamp - durationMs;
  for (let index = 0; index < series.points.length; index += 1) {
    if (series.points[index]?.time >= threshold) {
      return index;
    }
  }
  return 0;
};

export const calculateZoomRangeForPreset = (
  series: PortfolioEquitySeries,
  presetKey: ActiveDealsZoomPresetKey,
): DataZoomRange | undefined => {
  if (series.points.length <= 1) {
    return undefined;
  }

  const preset = PRESETS[presetKey];
  if (!preset || preset.durationMs === undefined) {
    return undefined;
  }

  const latestPoint = series.points[series.points.length - 1];
  if (!latestPoint) {
    return undefined;
  }

  const startIndex = findStartIndex(series, preset.durationMs, latestPoint.time);
  const maxIndex = series.points.length - 1;
  if (maxIndex <= 0) {
    return undefined;
  }

  const startPercent = clampToPercent((startIndex / maxIndex) * 100);

  if (startPercent <= 0) {
    return { start: 0, end: 100 };
  }

  return {
    start: startPercent,
    end: 100,
  } satisfies DataZoomRange;
};

export const areZoomRangesEqual = (left?: DataZoomRange, right?: DataZoomRange): boolean => {
  const leftStart = left?.start ?? undefined;
  const leftEnd = left?.end ?? undefined;
  const rightStart = right?.start ?? undefined;
  const rightEnd = right?.end ?? undefined;
  return leftStart === rightStart && leftEnd === rightEnd;
};

const ZOOM_PRESET_STORAGE_VALUES = new Set<ActiveDealsZoomPreset>([
  'lastHour',
  'last4Hours',
  'lastDay',
  'all',
  'custom',
]);

export const isActiveDealsZoomPreset = (value: unknown): value is ActiveDealsZoomPreset => {
  if (typeof value !== 'string') {
    return false;
  }
  return ZOOM_PRESET_STORAGE_VALUES.has(value as ActiveDealsZoomPreset);
};
