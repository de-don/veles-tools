import { describe, expect, it } from 'vitest';
import { parseAssetList } from '../assetList';

describe('parseAssetList', () => {
  it('returns unique trimmed symbols preserving input casing', () => {
    const result = parseAssetList(' btc,ETH  ,  btc  ,sol\nSOL ');

    expect(result).toEqual(['btc', 'ETH', 'sol']);
  });

  it('ignores empty input fragments', () => {
    const result = parseAssetList('\n , ,   \t');

    expect(result).toEqual([]);
  });
});
