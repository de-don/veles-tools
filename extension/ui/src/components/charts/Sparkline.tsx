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
}: SparklineProps) => {
  const { pathData, zeroLine } = useMemo(() => {
    if (!points || points.length === 0) {
      return { pathData: null, zeroLine: null };
    }

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 0);

    if (points.length === 1) {
      const chartHeight = height - MARGIN_Y * 2;
      const verticalSpan = maxValue - minValue || 1;
      const normalized = (points[0].value - minValue) / verticalSpan;
      const y = height - MARGIN_Y - normalized * chartHeight;
      const clampedY = Number.isFinite(y) ? Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, y)) : height / 2;
      const zeroNormalized = (0 - minValue) / verticalSpan;
      const zeroY = height - MARGIN_Y - zeroNormalized * chartHeight;
      const clampedZeroY = Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, zeroY));
      const zeroLineSegment = {
        x1: MARGIN_X,
        x2: width - MARGIN_X,
        y: clampedZeroY,
      };
      return { pathData: `M ${MARGIN_X} ${clampedY} L ${width - MARGIN_X} ${clampedY}`, zeroLine: zeroLineSegment };
    }

    const verticalSpan = maxValue - minValue || 1;
    const horizontalSpan = points.length - 1 || 1;

    const chartWidth = width - MARGIN_X * 2;
    const chartHeight = height - MARGIN_Y * 2;

    const commands = points.map((point, index) => {
      const x = MARGIN_X + (chartWidth * index) / horizontalSpan;
      const normalized = (point.value - minValue) / verticalSpan;
      const y = height - MARGIN_Y - normalized * chartHeight;
      const clampedY = Number.isFinite(y) ? Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, y)) : height / 2;
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${x} ${clampedY}`;
    });

    const zeroNormalized = (0 - minValue) / verticalSpan;
    const zeroY = height - MARGIN_Y - zeroNormalized * chartHeight;
    const clampedZeroY = Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, zeroY));
    const zeroLineSegment = {
      x1: MARGIN_X,
      x2: width - MARGIN_X,
      y: clampedZeroY,
    };

    return { pathData: commands.join(' '), zeroLine: zeroLineSegment };
  }, [points, height, width]);

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
