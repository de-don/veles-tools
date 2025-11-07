export const MS_IN_SECOND = 1000;
export const MS_IN_MINUTE = MS_IN_SECOND * 60;
export const MS_IN_HOUR = MS_IN_MINUTE * 60;
export const MS_IN_DAY = MS_IN_HOUR * 24;

export const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const resolvePeriodDays = (from: string, to: string): number | null => {
  const fromTimestamp = toTimestamp(from);
  const toTimestampValue = toTimestamp(to);
  if (fromTimestamp === null || toTimestampValue === null) {
    return null;
  }
  if (toTimestampValue < fromTimestamp) {
    return null;
  }
  const durationDays = (toTimestampValue - fromTimestamp) / MS_IN_DAY;
  return durationDays + 1;
};
