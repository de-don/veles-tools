import { describe, expect, it } from 'vitest';
import { readLimitAnalysisPreferences, writeLimitAnalysisPreferences } from '../backtestLimitAnalysisStore';

describe('backtestLimitAnalysisStore', () => {
  it('returns null when there is no saved entry', () => {
    window.localStorage.clear();
    expect(readLimitAnalysisPreferences('group-1')).toBeNull();
  });

  it('persists preferences per group id', () => {
    window.localStorage.clear();

    writeLimitAnalysisPreferences('group-1', { maxLimit: 7 });
    writeLimitAnalysisPreferences('group-2', { maxLimit: 3 });

    expect(readLimitAnalysisPreferences('group-1')).toEqual({ maxLimit: 7 });
    expect(readLimitAnalysisPreferences('group-2')).toEqual({ maxLimit: 3 });
  });

  it('overwrites existing entries for the same group', () => {
    window.localStorage.clear();

    writeLimitAnalysisPreferences('group-1', { maxLimit: 4 });
    writeLimitAnalysisPreferences('group-1', { maxLimit: 12 });

    expect(readLimitAnalysisPreferences('group-1')).toEqual({ maxLimit: 12 });
  });
});
