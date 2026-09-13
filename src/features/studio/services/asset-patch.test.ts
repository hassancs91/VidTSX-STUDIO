import { describe, it, expect } from 'vitest';
import { patchProjectAsset, sameIdSet, withCacheFile } from './asset-patch';
import type { StudioMediaAsset, StudioProject } from '../types';

const asset = (id: string, extra: Partial<StudioMediaAsset> = {}): StudioMediaAsset =>
  ({ id, kind: 'video', path: `C:/m/${id}.mp4`, ...extra }) as unknown as StudioMediaAsset;

const project = (assets: StudioMediaAsset[]): StudioProject => ({ id: 'p', assets } as unknown as StudioProject);

describe('withCacheFile', () => {
  it('returns the same asset when a re-announced proxy/waveform is already recorded', () => {
    const a = asset('a', { proxy: { path: 'proxies/a.mp4', status: 'ready' } });
    expect(withCacheFile(a, 'proxy', { path: 'proxies/a.mp4', status: 'ready' })).toBe(a);
  });

  it('records a real change: new status, new path, or a first entry', () => {
    const a = asset('a', { waveform: { path: 'waveforms/a.json', status: 'generating' } });
    expect(withCacheFile(a, 'waveform', { path: 'waveforms/a.json', status: 'ready' }).waveform).toEqual({
      path: 'waveforms/a.json',
      status: 'ready',
    });
    expect(withCacheFile(a, 'waveform', { path: 'waveforms/a2.json', status: 'generating' })).not.toBe(a);
    const bare = asset('b');
    expect(withCacheFile(bare, 'proxy', { path: 'proxies/b.mp4', status: 'generating' }).proxy?.status).toBe('generating');
  });
});

describe('patchProjectAsset', () => {
  it('keeps the project object when the patch changes nothing — no re-render, no autosave', () => {
    const p = project([asset('a'), asset('b')]);
    expect(patchProjectAsset(p, 'a', (x) => x)).toBe(p);
    expect(patchProjectAsset(p, 'missing', () => asset('zzz'))).toBe(p);
  });

  it('replaces only the patched asset when something changed', () => {
    const b = asset('b');
    const p = project([asset('a'), b]);
    const next = patchProjectAsset(p, 'a', (x) => ({ ...x, path: 'C:/moved/a.mp4' }));
    expect(next).not.toBe(p);
    expect(next.assets[0]!.path).toBe('C:/moved/a.mp4');
    expect(next.assets[1]).toBe(b);
  });
});

describe('sameIdSet', () => {
  it('compares contents, not identity', () => {
    expect(sameIdSet(new Set(), [])).toBe(true);
    expect(sameIdSet(new Set(['a', 'b']), ['b', 'a'])).toBe(true);
    expect(sameIdSet(new Set(['a']), ['a', 'b'])).toBe(false);
    expect(sameIdSet(new Set(['a', 'b']), ['a', 'a'])).toBe(false);
  });
});
