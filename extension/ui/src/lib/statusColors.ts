import type { BotStatus } from '../types/bots';

const STATUS_COLOR_MAP: Record<BotStatus, string> = {
  RUNNING: 'green',
  AWAITING_SIGNAL: 'gold',
  TERMINATED: 'default',
  AWAITING_TERMINATION: 'orange',
  FAILED: 'red',
};

export const resolveBotStatusColor = (status: BotStatus): string => STATUS_COLOR_MAP[status] ?? 'default';
