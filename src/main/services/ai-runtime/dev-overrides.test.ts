import { describe, expect, it } from 'vitest';
import { parseAiRuntimeDevOverrides } from './dev-overrides';

describe('parseAiRuntimeDevOverrides', () => {
  it('returns null when unset, malformed, or in a packaged build', () => {
    expect(parseAiRuntimeDevOverrides(undefined, false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('', false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('not json', false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('[1]', false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('{}', false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('{"freeBytes":1}', true)).toBeNull();
  });

  it('keeps only well-typed fields', () => {
    const o = parseAiRuntimeDevOverrides(
      JSON.stringify({ root: 'C:\\long\\root', freeBytes: 1234, driverVersion: '470.00', vramTotalMB: 2048, gpuName: null, junk: 1, }),
      false,
    );
    expect(o).toEqual({ root: 'C:\\long\\root', freeBytes: 1234, driverVersion: '470.00', vramTotalMB: 2048, gpuName: null });
    expect(parseAiRuntimeDevOverrides('{"freeBytes":-5,"root":""}', false)).toBeNull();
    expect(parseAiRuntimeDevOverrides('{"vramTotalMB":"4096"}', false)).toBeNull();
  });
});
