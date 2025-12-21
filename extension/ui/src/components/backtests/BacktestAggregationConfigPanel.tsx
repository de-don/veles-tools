import type { SliderSingleProps } from 'antd';
import { Slider } from 'antd';
import type { AggregationConfig } from '../../types/backtestAggregations';

interface BacktestAggregationConfigPanelProps {
  value: AggregationConfig;
  onChange: (config: AggregationConfig) => void;
  disabled?: boolean;
  maxLimit: number;
}

const MIN_CONCURRENCY = 1;

const BacktestAggregationConfigPanel = ({
  value,
  onChange,
  disabled,
  maxLimit,
}: BacktestAggregationConfigPanelProps) => {
  const handleSliderChange: SliderSingleProps['onChange'] = (nextValue) => {
    onChange({ ...value, maxConcurrentPositions: nextValue });
  };

  const maxValue = Math.max(MIN_CONCURRENCY, maxLimit);
  const sliderValue = Math.min(value.maxConcurrentPositions, maxValue);

  const marks =
    maxValue === MIN_CONCURRENCY
      ? undefined
      : {
          [MIN_CONCURRENCY]: String(MIN_CONCURRENCY),
          [maxValue]: String(maxValue),
        };

  return (
    <div>
      <div className="aggregation-config__title">Лимит по одновременным позициям</div>
      <Slider
        min={MIN_CONCURRENCY}
        max={maxValue}
        value={sliderValue}
        onChange={handleSliderChange}
        marks={marks}
        disabled={disabled}
      />
    </div>
  );
};

export default BacktestAggregationConfigPanel;
