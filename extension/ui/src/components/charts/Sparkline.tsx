import { useMemo } from 'react';

export interface SparklinePoint {
  time: number;
  value: number;
}

export interface SparklineProps {
  points: readonly SparklinePoint[];
  width?: number;
  height?: number;
  strokePositive?: string;
  strokeNegative?: string;
  strokeNeutral?: string;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
  minTime?: number;
  maxTime?: number;
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 32;
const DEFAULT_STROKE_WIDTH = 1.5;
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

export const Sparkline = ({
  points,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  strokePositive = '#047857',
  strokeNegative = '#b91c1c',
  strokeNeutral = '#64748b',
  strokeWidth = DEFAULT_STROKE_WIDTH,
  className,
  ariaLabel,
  minTime,
  maxTime,
}: SparklineProps) => {
  const { pathData, zeroLine } = useMemo(() => {
    if (!points || points.length === 0) {
      return { pathData: null, zeroLine: null };
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

    let commands: string[];

    // Time-based rendering if minTime/maxTime are provided
    if (typeof minTime === 'number' && typeof maxTime === 'number' && maxTime > minTime) {
      const timeSpan = maxTime - minTime;

      commands = points.map((point, index) => {
        // Calculate X based on time relative to the window
        const timeOffset = point.time - minTime;
        const normalizedTime = Math.max(0, Math.min(1, timeOffset / timeSpan));
        const x = MARGIN_X + normalizedTime * chartWidth;

        const y = getY(point.value);
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${x} ${y}`;
      });
    } else {
      // Fallback to index-based rendering
      if (points.length === 1) {
        const y = getY(points[0].value);
        const zeroY = getY(0);
        const zeroLineSegment = {
          x1: MARGIN_X,
          x2: width - MARGIN_X,
          y: zeroY,
        };
        return { pathData: `M ${MARGIN_X} ${y} L ${width - MARGIN_X} ${y}`, zeroLine: zeroLineSegment };
      }

      const horizontalSpan = points.length - 1 || 1;
      commands = points.map((point, index) => {
        const x = MARGIN_X + (chartWidth * index) / horizontalSpan;
        const y = getY(point.value);
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${x} ${y}`;
      });
    }

    const zeroY = getY(0);
    const zeroLineSegment = {
      x1: MARGIN_X,
      x2: width - MARGIN_X,
      y: zeroY,
    };

    return { pathData: commands.join(' '), zeroLine: zeroLineSegment };
  }, [points, height, width, minTime, maxTime]);

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
    </svg>
  );
};

export default Sparkline;
