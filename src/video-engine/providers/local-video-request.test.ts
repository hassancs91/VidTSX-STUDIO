import { describe, expect, it } from 'vitest';
import { framesForDuration, sizeForAspect } from './local-video-request';

describe('framesForDuration', () => {
  it('aligns Wan to 4n+1 — 2 s at 16 fps is the registry default of 33 frames', () => {
    expect(framesForDuration('wan21', 2, 16)).toBe(33);
    expect(framesForDuration('wan22', 3, 16)).toBe(49);
    expect(framesForDuration('lingbot', 5, 16)).toBe(81);
  });

  it('aligns LTX to 8n+1 at 24 fps', () => {
    expect(framesForDuration('ltx', 2, 24)).toBe(49);
    expect(framesForDuration('ltx', 5, 24)).toBe(121);
  });

  it('never goes below one frame', () => {
    expect(framesForDuration('wan21', 0, 16)).toBe(1);
  });
});

describe('sizeForAspect', () => {
  const wan = { width: 832, height: 480 };

  it('keeps the native landscape size for 16:9 and anything unknown', () => {
    expect(sizeForAspect(wan, '16:9')).toEqual({ width: 832, height: 480 });
    expect(sizeForAspect(wan, '4:3')).toEqual({ width: 832, height: 480 });
  });

  it('swaps for portrait and squares on the short side', () => {
    expect(sizeForAspect(wan, '9:16')).toEqual({ width: 480, height: 832 });
    expect(sizeForAspect(wan, '1:1')).toEqual({ width: 480, height: 480 });
  });
});
