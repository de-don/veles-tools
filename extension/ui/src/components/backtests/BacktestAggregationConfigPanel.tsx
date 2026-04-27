import type { SliderSingleProps } from 'antd';
import { Button, DatePicker, Flex, Slider, Space, Switch } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
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

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates?.[0] || !dates[1]) {
      onChange({ ...value, dateRangeStart: undefined, dateRangeEnd: undefined });
      return;
    }
    onChange({
      ...value,
      dateRangeStart: dates[0].startOf('day').valueOf(),
      dateRangeEnd: dates[1].endOf('day').valueOf(),
    });
  };

  const handleClearDateRange = () => {
    onChange({ ...value, dateRangeStart: undefined, dateRangeEnd: undefined });
  };

  const maxValue = Math.max(MIN_CONCURRENCY, maxLimit);
  const sliderValue = Math.min(value.maxConcurrentPositions, maxValue);
  const dateRangeValue =
    value.dateRangeStart !== undefined && value.dateRangeEnd !== undefined
      ? ([dayjs(value.dateRangeStart), dayjs(value.dateRangeEnd)] as [Dayjs, Dayjs])
      : null;

  const marks =
    maxValue === MIN_CONCURRENCY
      ? undefined
      : {
          [MIN_CONCURRENCY]: String(MIN_CONCURRENCY),
          [maxValue]: String(maxValue),
        };

  return (
    <Flex gap={24} wrap="wrap" align="flex-start">
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
      <div>
        <div className="aggregation-config__title">Фильтр по периоду</div>
        <Space>
          <DatePicker.RangePicker
            value={dateRangeValue}
            onChange={handleDateRangeChange}
            disabled={disabled}
            format="YYYY-MM-DD"
            allowClear
          />
          {(value.dateRangeStart !== undefined || value.dateRangeEnd !== undefined) && (
            <Button type="text" onClick={handleClearDateRange} disabled={disabled}>
              Очистить
            </Button>
          )}
        </Space>
      </div>
    </Flex>
  );
};

export default BacktestAggregationConfigPanel;
