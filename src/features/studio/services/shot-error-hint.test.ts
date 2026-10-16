import { describe, expect, it } from 'vitest';
import { PROD_REACT_HINT, shotErrorHint, windowErrorHint } from './shot-error-hint';

const MODULE = 'http://127.0.0.1:3200/modules/0742e1e7fede.js';

/** An uncaught error as L0a saw it (10-15): React's createElement, called from the shot's inlined R3F. */
function r3fError(stackUrl: string, message = 'dispatcher.getOwner is not a function'): Error {
  const error = new TypeError(message);
  error.stack = [
    `TypeError: ${message}`,
    '    at getOwner (http://localhost:5173/@fs/D:/repos/VidTSX-STUDIO/node_modules/.vite/deps/chunk-OTTQSYDI.js?v=ec8f9ad5:133:56)',
    '    at exports.createElement (http://localhost:5173/@fs/D:/repos/VidTSX-STUDIO/node_modules/.vite/deps/chunk-OTTQSYDI.js?v=ec8f9ad5:791:11)',
    `    at jsx (${stackUrl}:43827:42)`,
  ].join('\n');
  return error;
}

describe('windowErrorHint', () => {
  it("claims an uncaught error from this shot's module with a known cause", () => {
    expect(windowErrorHint(r3fError(MODULE), MODULE)).toBe('dispatcher.getOwner is not a function');
  });

  it("leaves another shot's error, an unknown cause and a non-error alone", () => {
    expect(windowErrorHint(r3fError('http://127.0.0.1:3200/modules/other.js'), MODULE)).toBeNull();
    expect(windowErrorHint(r3fError(MODULE, 'Cannot read properties of undefined'), MODULE)).toBeNull();
    expect(windowErrorHint('getOwner is not a function', MODULE)).toBeNull();
    expect(windowErrorHint(r3fError(MODULE), '')).toBeNull();
  });
});

describe('shotErrorHint', () => {
  it("names the D9 switch for R3F's production reconciler on development React", () => {
    expect(shotErrorHint('dispatcher.getOwner is not a function')).toBe(PROD_REACT_HINT);
    expect(shotErrorHint('TypeError: A.getOwner is not a function')).toBe(PROD_REACT_HINT);
    expect(PROD_REACT_HINT).toBe(
      'This 3D shot needs production React under npm run dev: start with VIDTSX_DEV_PROD_REACT=1. A packaged app plays it.',
    );
  });

  it('leaves every other error to speak for itself', () => {
    expect(shotErrorHint('Cannot read properties of undefined (reading "map")')).toBeNull();
    expect(shotErrorHint('Shot source missing: intro v2')).toBeNull();
    expect(shotErrorHint('')).toBeNull();
  });
});
