import { describe, expect, it } from 'vitest';
import { applyBotNameTemplate } from '../nameTemplate';

describe('applyBotNameTemplate', () => {
  it('replaces placeholders case-insensitively', () => {
    const result = applyBotNameTemplate('Test {BOT_name} on {Currency}', 'Alpha', 'USDT');

    expect(result).toBe('Test Alpha on USDT');
  });

  it('supports {asset} alias for backward compatibility', () => {
    const result = applyBotNameTemplate('{asset}-{bot_name}', 'Gamma', 'BTC');

    expect(result).toBe('BTC-Gamma');
  });
});
