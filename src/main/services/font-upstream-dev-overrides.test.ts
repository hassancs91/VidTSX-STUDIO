import { describe, expect, it } from 'vitest';
import { parseFontUpstreamDevOverrides } from './font-upstream-dev-overrides';

describe('parseFontUpstreamDevOverrides', () => {
  it('blocks for the process, or while a file exists', () => {
    expect(parseFontUpstreamDevOverrides('{"block":true}', false)).toEqual({ block: true });
    expect(parseFontUpstreamDevOverrides('{"blockWhileExists":"D:\\\\x\\\\block"}', false)).toEqual({
      block: false,
      blockWhileExists: 'D:\\x\\block',
    });
  });

  it('is ignored in packaged builds', () => {
    expect(parseFontUpstreamDevOverrides('{"block":true}', true)).toBeNull();
  });

  it('ignores missing, malformed and inert input', () => {
    expect(parseFontUpstreamDevOverrides(undefined, false)).toBeNull();
    expect(parseFontUpstreamDevOverrides('not json', false)).toBeNull();
    expect(parseFontUpstreamDevOverrides('[true]', false)).toBeNull();
    expect(parseFontUpstreamDevOverrides('{"block":false}', false)).toBeNull();
    expect(parseFontUpstreamDevOverrides('{"block":"yes"}', false)).toBeNull();
    expect(parseFontUpstreamDevOverrides('{"blockWhileExists":""}', false)).toBeNull();
  });
});
