import { Checkbox, Input } from 'antd';
import { formatReinvestRange, REINVEST_DEFAULT_PERCENT } from '../../lib/reinvest';

interface ReinvestFieldProps {
  id: string;
  enabled: boolean;
  value: string;
  maxPercent: number;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
}

const ReinvestField = ({
  id,
  enabled,
  value,
  maxPercent,
  disabled = false,
  onEnabledChange,
  onValueChange,
}: ReinvestFieldProps) => {
  const handleToggle = (checked: boolean) => {
    if (checked && value.trim().length === 0) {
      onValueChange(String(Math.min(REINVEST_DEFAULT_PERCENT, maxPercent)));
    }
    onEnabledChange(checked);
  };

  return (
    <div className="form-field">
      <Checkbox checked={enabled} disabled={disabled} onChange={(event) => handleToggle(event.target.checked)}>
        Реинвест прибыли
      </Checkbox>
      <Input
        id={id}
        className="u-mt-8"
        type="text"
        inputMode="decimal"
        suffix="%"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={!enabled || disabled}
        placeholder={formatReinvestRange(maxPercent)}
      />
      <span className="form-hint">
        После каждой прибыльной сделки выбранный процент NET-прибыли возвращается в депозит бота. Допустимо{' '}
        {formatReinvestRange(maxPercent)}.
      </span>
    </div>
  );
};

export default ReinvestField;
