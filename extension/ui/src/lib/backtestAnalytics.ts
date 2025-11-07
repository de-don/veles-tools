export const calculateMaxDrawdown = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  let peak = values[0];
  let maxDrawdown = 0;

  values.forEach((value) => {
    if (value > peak) {
      peak = value;
      return;
    }
    const drawdown = peak - value;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return maxDrawdown;
};
