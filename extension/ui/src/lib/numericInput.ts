export const sanitizeNumberInput = (value: string): string => {
  return value.replace(/[\s_]/g, '').replace(',', '.');
};

export const parseNumericInput = (value: string): number | null => {
  const normalized = sanitizeNumberInput(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
