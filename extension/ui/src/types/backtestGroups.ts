export interface BacktestGroup {
  id: string;
  name: string;
  backtestIds: number[];
  createdAt: number;
  updatedAt: number;
}

export type BacktestGroupUpdate = Pick<BacktestGroup, 'id' | 'name' | 'backtestIds'>;
