export const resolveSortableNumber = (value: number | null | undefined): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};
