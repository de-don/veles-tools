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

const sortPointsByTime = (points: PortfolioEquitySeries['points']): PortfolioEquitySeries['points'] => {
  if (points.length <= 1) {
    return points;
  }
  return [...points].sort((left, right) => left.time - right.time);
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

  const sortedPoints = sortPointsByTime(series.points);
  const latestPoint = sortedPoints[sortedPoints.length - 1];
  if (!latestPoint) {
    return undefined;
  }

  const startValue = latestPoint.time - preset.durationMs;
  return {
    startValue,
    endValue: latestPoint.time,
  } satisfies DataZoomRange;
};

export const areZoomRangesEqual = (left?: DataZoomRange, right?: DataZoomRange): boolean => {
  const leftStart = left?.start ?? undefined;
  const leftEnd = left?.end ?? undefined;
  const leftStartValue = left?.startValue ?? undefined;
  const leftEndValue = left?.endValue ?? undefined;
  const rightStart = right?.start ?? undefined;
  const rightEnd = right?.end ?? undefined;
  const rightStartValue = right?.startValue ?? undefined;
  const rightEndValue = right?.endValue ?? undefined;
  return (
    leftStart === rightStart &&
    leftEnd === rightEnd &&
    leftStartValue === rightStartValue &&
    leftEndValue === rightEndValue
  );
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
