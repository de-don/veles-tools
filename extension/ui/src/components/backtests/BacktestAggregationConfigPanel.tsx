import type { SliderSingleProps } from 'antd';
import { Flex, Slider, Switch } from 'antd';
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

  const handlePositionBlockingChange = (checked: boolean) => {
    onChange({ ...value, positionBlocking: checked });
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
    <Flex gap={24}>
      <div style={{ flex: 1 }}>
        <div className="aggregation-config__title">Блокировка по ботам</div>
        <Slider
          min={MIN_CONCURRENCY}
          max={maxValue}
          value={sliderValue}
          onChange={handleSliderChange}
          marks={marks}
          disabled={disabled}
        />
      </div>
      <div style={{ paddingTop: 4 }}>
        <div className="aggregation-config__title">Блокировка по позиции</div>
        <Switch
          checked={value.positionBlocking}
          onChange={handlePositionBlockingChange}
          disabled={disabled}
          size="small"
        />
      </div>
    </Flex>
  );
};

export default BacktestAggregationConfigPanel;
