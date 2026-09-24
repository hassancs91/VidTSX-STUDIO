import { describe, it, expect, vi, afterEach } from 'vitest';
import { isContentSafetyBypassed } from './dev-bypass';

const ENV = 'VIDTSX_DEV_DISABLE_CONTENT_SAFETY';

describe('Content Safety dev bypass (D2d, Rev 4)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default', () => {
    expect(isContentSafetyBypassed()).toBe(false);
  });

  it('turns on in a dev build with the opt-in set to exactly "1"', () => {
    vi.stubEnv(ENV, '1');
    expect(isContentSafetyBypassed()).toBe(true);
  });

  it('ignores every other value — the opt-in is not a truthiness check', () => {
    for (const value of ['', '0', 'true', 'yes', ' 1']) {
      vi.stubEnv(ENV, value);
      expect(isContentSafetyBypassed(), `value "${value}"`).toBe(false);
    }
  });

  it('stays off outside a dev build even with the opt-in set', () => {
    vi.stubEnv(ENV, '1');
    vi.stubEnv('DEV', false);
    expect(isContentSafetyBypassed()).toBe(false);
  });
});
