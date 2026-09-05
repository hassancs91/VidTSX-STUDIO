import { describe, expect, it } from 'vitest';
import { computeAiRuntimeState } from './status';
import { parseAiRuntimeManifest } from './manifest';

const installed = (version: string) => ({
  kind: 'installed' as const,
  info: { version, variant: 'cu126' as const, dir: 'x', python: 'x\\python\\python.exe', torch: '2.14.0+cu126', bytesOnDisk: 1 },
});

describe('computeAiRuntimeState', () => {
  it('maps disk + activity to the row state', () => {
    expect(computeAiRuntimeState({ kind: 'none' }, '2026.09.1', false)).toBe('missing');
    expect(computeAiRuntimeState(installed('2026.09.1'), '2026.09.1', false)).toBe('installed');
    expect(computeAiRuntimeState(installed('2026.08.3'), '2026.09.1', false)).toBe('update-available');
    expect(computeAiRuntimeState({ kind: 'broken', dir: 'x', reason: 'manifest.json missing' }, '2026.09.1', false)).toBe('broken');
  });

  it('installing wins over everything else', () => {
    expect(computeAiRuntimeState({ kind: 'none' }, '2026.09.1', true)).toBe('installing');
    expect(computeAiRuntimeState(installed('2026.08.3'), '2026.09.1', true)).toBe('installing');
  });
});

describe('parseAiRuntimeManifest', () => {
  const good = {
    schema: 1,
    name: '2026.09.1-cpu',
    version: '2026.09.1',
    variant: 'cpu',
    python: '3.11.15',
    torch: '2.14.0+cpu',
    cuda: null,
    minDriver: null,
    maxRelativePathLength: 126,
    bytesOnDisk: 899222488,
    files: 14190,
    pythonDir: 'python',
    pipelines: ['triposr', 'rembg'],
  };

  it('accepts the build script output and defaults pythonDir', () => {
    const m = parseAiRuntimeManifest(good);
    expect(m.variant).toBe('cpu');
    expect(m.cuda).toBeNull();
    expect(m.pipelines).toEqual(['triposr', 'rembg']);
    const { pythonDir: _omit, ...noDir } = good;
    expect(parseAiRuntimeManifest(noDir).pythonDir).toBe('python');
  });

  it('rejects a missing field, a bad variant and a non-object with readable errors', () => {
    expect(() => parseAiRuntimeManifest({ ...good, torch: undefined })).toThrow(/"torch"/);
    expect(() => parseAiRuntimeManifest({ ...good, variant: 'rocm' })).toThrow(/unknown variant/);
    expect(() => parseAiRuntimeManifest('nope')).toThrow(/not a JSON object/);
    expect(() => parseAiRuntimeManifest({ ...good, bytesOnDisk: -1 })).toThrow(/"bytesOnDisk"/);
  });
});
