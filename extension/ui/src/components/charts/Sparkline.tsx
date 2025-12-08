import { useMemo } from 'react';

export interface SparklinePoint {
  time: number;
  value: number;
}

export interface SparklineMarker {
  time: number;
  value?: number;
  color?: string;
}

export interface SparklineProps {
  points: readonly SparklinePoint[];
  width?: number;
  height?: number;
  strokePositive?: string;
  strokeNegative?: string;
  strokeNeutral?: string;
  strokeWidth?: number;
  markers?: readonly SparklineMarker[];
  markerRadius?: number;
  className?: string;
  ariaLabel?: string;
  minTime?: number;
  maxTime?: number;
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 32;
const DEFAULT_STROKE_WIDTH = 1.5;
const DEFAULT_MARKER_RADIUS = 3;
const MARGIN_X = 4;
const MARGIN_Y = 4;

const resolveStrokeColor = (
  points: readonly SparklinePoint[],
  colors: {
    positive: string;
    negative: string;
    neutral: string;
  },
): string => {
  if (points.length === 0) {
    return colors.neutral;
  }
  const last = points[points.length - 1].value;
  if (last > 0) {
    return colors.positive;
  }
  if (last < 0) {
    return colors.negative;
  }
  return colors.neutral;
};

const interpolateValue = (series: readonly SparklinePoint[], targetTime: number): number | null => {
  if (!series.length) {
    return null;
  }
  if (series.length === 1) {
    return series[0].value;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (!(first && last)) {
    return null;
  }
  if (targetTime <= first.time) {
    return first.value;
  }
  if (targetTime >= last.time) {
    return last.value;
  }

  let left = 0;
  let right = series.length - 1;
  while (right - left > 1) {
    const mid = Math.floor((left + right) / 2);
    const point = series[mid];
    if (!point) {
      break;
    }
    if (point.time === targetTime) {
      return point.value;
    }
    if (point.time < targetTime) {
      left = mid;
    } else {
      right = mid;
    }
  }

  const before = series[left];
  const after = series[right];
  if (!(before && after) || before.time === after.time) {
    return null;
  }

  const ratio = (targetTime - before.time) / (after.time - before.time);
  return before.value + (after.value - before.value) * ratio;
};

export const Sparkline = ({
  points,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  strokePositive = '#047857',
  strokeNegative = '#b91c1c',
  strokeNeutral = '#64748b',
  strokeWidth = DEFAULT_STROKE_WIDTH,
  markers,
  markerRadius = DEFAULT_MARKER_RADIUS,
  className,
  ariaLabel,
  minTime,
  maxTime,
}: SparklineProps) => {
  const { pathData, zeroLine, markerPositions } = useMemo(() => {
    if (!points || points.length === 0) {
      return { pathData: null, zeroLine: null, markerPositions: [] };
    }

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);

    const chartWidth = width - MARGIN_X * 2;
    const chartHeight = height - MARGIN_Y * 2;
    const verticalSpan = maxValue - minValue || 1;

    // Helper to calculate Y coordinate
    const getY = (val: number) => {
      const normalized = (val - minValue) / verticalSpan;
      const y = height - MARGIN_Y - normalized * chartHeight;
      return Number.isFinite(y) ? Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, y)) : height / 2;
    };

    const usesTimeScale = typeof minTime === 'number' && typeof maxTime === 'number' && maxTime > minTime;
    const resolvedMinTime = usesTimeScale ? minTime : points[0]?.time;
    const resolvedMaxTime = usesTimeScale ? maxTime : points[points.length - 1]?.time;
    const resolvedTimeSpan =
      typeof resolvedMinTime === 'number' && typeof resolvedMaxTime === 'number'
        ? Math.max(0, resolvedMaxTime - resolvedMinTime)
        : null;

    const clampTime = (value: number): number => {
      if (typeof resolvedMinTime !== 'number' || typeof resolvedMaxTime !== 'number') {
        return value;
      }
      return Math.min(Math.max(value, resolvedMinTime), resolvedMaxTime);
    };

    const getXByTime = (timestamp: number): number => {
      if (resolvedTimeSpan && resolvedTimeSpan > 0 && typeof resolvedMinTime === 'number') {
        const normalized = (clampTime(timestamp) - resolvedMinTime) / resolvedTimeSpan;
        return MARGIN_X + normalized * chartWidth;
      }
      return width / 2;
    };

    // Fallback to index-based rendering
    if (!usesTimeScale && points.length === 1) {
      const y = getY(points[0].value);
      const zeroY = getY(0);
      const zeroLineSegment = {
        x1: MARGIN_X,
        x2: width - MARGIN_X,
        y: zeroY,
      };
      return {
        pathData: `M ${MARGIN_X} ${y} L ${width - MARGIN_X} ${y}`,
        zeroLine: zeroLineSegment,
        markerPositions: [],
      };
    }

    const horizontalSpan = points.length - 1 || 1;
    const getXByIndex = (index: number): number => MARGIN_X + (chartWidth * index) / horizontalSpan;

    const resolveX = (index: number, timestamp: number): number => {
      if (usesTimeScale && resolvedTimeSpan) {
        return getXByTime(timestamp);
      }
      return getXByIndex(index);
    };

    const commands: string[] = points.map((point, index) => {
      const x = resolveX(index, point.time);
      const y = getY(point.value);
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${x} ${y}`;
    });

    const zeroY = getY(0);
    const zeroLineSegment = {
      x1: MARGIN_X,
      x2: width - MARGIN_X,
      y: zeroY,
    };

    const markerPositions =
      markers?.flatMap((marker) => {
        if (!Number.isFinite(marker.time)) {
          return [];
        }
        const markerValue =
          typeof marker.value === 'number' && Number.isFinite(marker.value)
            ? marker.value
            : interpolateValue(points, marker.time);
        if (markerValue === null) {
          return [];
        }

        const nearestIndex = points.reduce(
          (best, point, index) => {
            const distance = Math.abs(point.time - marker.time);
            if (distance < best.distance) {
              return { distance, index };
            }
            return best;
          },
          { distance: Number.POSITIVE_INFINITY, index: 0 },
        ).index;
        const x = resolveX(nearestIndex, marker.time);
        const y = getY(markerValue);
        return [{ x, y, color: marker.color }];
      }) ?? [];

    return { pathData: commands.join(' '), zeroLine: zeroLineSegment, markerPositions };
  }, [points, height, width, minTime, maxTime, markers]);

  const strokeColor = useMemo(
    () => resolveStrokeColor(points, { positive: strokePositive, negative: strokeNegative, neutral: strokeNeutral }),
    [points, strokeNegative, strokeNeutral, strokePositive],
  );

  if (!pathData) {
    return <div className={className}>{'—'}</div>;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      className={className}
      focusable="false"
    >
      {zeroLine ? (
        <line
          x1={zeroLine.x1}
          x2={zeroLine.x2}
          y1={zeroLine.y}
          y2={zeroLine.y}
          stroke="rgba(148, 163, 184, 0.6)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}
      <path d={pathData} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      {markerPositions.map((marker, index) => (
        <circle
          key={`marker-${index}-${marker.x}-${marker.y}`}
          cx={marker.x}
          cy={marker.y}
          r={markerRadius}
          fill={marker.color ?? strokeColor}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

export default Sparkline;
