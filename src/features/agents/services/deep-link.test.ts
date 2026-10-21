import { describe, expect, it } from 'vitest';
import { deepLinkToApply } from './deep-link';

const link = { sessionId: 's-a', token: 100 };

describe('deepLinkToApply (P5-6: once per token)', () => {
  it('does nothing without a link', () => {
    expect(deepLinkToApply(undefined, null, true, ['s-a'])).toEqual({ apply: null, consumedToken: null });
  });

  it('waits for the list to load, without consuming the token', () => {
    expect(deepLinkToApply(link, null, false, [])).toEqual({ apply: null, consumedToken: null });
  });

  it('applies a linked session that exists, and consumes the token', () => {
    expect(deepLinkToApply(link, null, true, ['s-b', 's-a'])).toEqual({ apply: 's-a', consumedToken: 100 });
  });

  it('ignores a session that no longer exists, and still consumes the token', () => {
    expect(deepLinkToApply(link, null, true, ['s-b'])).toEqual({ apply: null, consumedToken: 100 });
  });

  it('never re-applies a consumed token when the list changes ("+" creates a session)', () => {
    const first = deepLinkToApply(link, null, true, ['s-a']);
    const afterPlus = deepLinkToApply(link, first.consumedToken, true, ['s-new', 's-a']);
    expect(afterPlus).toEqual({ apply: null, consumedToken: 100 });
  });

  it('a new token for the same session applies again (Continue clicked twice)', () => {
    expect(deepLinkToApply({ sessionId: 's-a', token: 200 }, 100, true, ['s-a'])).toEqual({
      apply: 's-a',
      consumedToken: 200,
    });
  });

  it('a session that appears later is not chased once the token is consumed', () => {
    const first = deepLinkToApply(link, null, true, ['s-b']);
    expect(deepLinkToApply(link, first.consumedToken, true, ['s-b', 's-a']).apply).toBeNull();
  });
});
