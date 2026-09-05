import { describe, expect, it } from 'vitest';
import {
  AI_RUNTIME_CATALOGUE,
  AI_RUNTIME_R2_BASE,
  AI_RUNTIME_VARIANTS,
  AI_RUNTIME_VERSION,
  aiRuntimeDirName,
  aiRuntimeDownloadId,
  formatRuntimeBytes,
  parseAiRuntimeDirName,
} from './catalogue';

describe('AI runtime catalogue invariants', () => {
  it('has exactly the two variants, both pinned to the app runtime version', () => {
    expect(Object.keys(AI_RUNTIME_CATALOGUE).sort()).toEqual(['cpu', 'cu126']);
    for (const variant of AI_RUNTIME_VARIANTS) {
      const e = AI_RUNTIME_CATALOGUE[variant];
      expect(e.variant).toBe(variant);
      expect(e.version).toBe(AI_RUNTIME_VERSION);
      expect(e.version).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    }
  });

  it('every URL is https on the R2 domain and names the zip <version>-<variant>.zip', () => {
    for (const variant of AI_RUNTIME_VARIANTS) {
      const e = AI_RUNTIME_CATALOGUE[variant];
      expect(e.urls.length).toBeGreaterThan(0);
      for (const url of e.urls) expect(url).toMatch(/^https:\/\//);
      expect(e.urls[0]).toBe(`${AI_RUNTIME_R2_BASE}/${aiRuntimeDirName(e.version, variant)}.zip`);
    }
  });

  it('hashes are 64-hex, sizes positive, extracted tree larger than the zip', () => {
    for (const variant of AI_RUNTIME_VARIANTS) {
      const e = AI_RUNTIME_CATALOGUE[variant];
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.lockSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.bytes).toBeGreaterThan(0);
      expect(e.bytesOnDisk).toBeGreaterThan(e.bytes);
      expect(e.files).toBeGreaterThan(1000);
      expect(e.extractedDir).toBe('python');
      expect(e.maxRelativePathLength).toBeGreaterThan(0);
      expect(e.maxRelativePathLength).toBeLessThan(200);
    }
  });

  it('torch build tags match the variant; only cu126 carries CUDA + a driver floor', () => {
    expect(AI_RUNTIME_CATALOGUE.cu126.torch).toMatch(/\+cu126$/);
    expect(AI_RUNTIME_CATALOGUE.cpu.torch).toMatch(/\+cpu$/);
    expect(AI_RUNTIME_CATALOGUE.cu126.cuda).toBe('12.6');
    expect(AI_RUNTIME_CATALOGUE.cu126.minDriver).toMatch(/^\d+\.\d+$/);
    expect(AI_RUNTIME_CATALOGUE.cpu.cuda).toBeNull();
    expect(AI_RUNTIME_CATALOGUE.cpu.minDriver).toBeNull();
    // Same python, same lock inputs → both variants share the Python version.
    expect(AI_RUNTIME_CATALOGUE.cpu.python).toBe(AI_RUNTIME_CATALOGUE.cu126.python);
  });

  it('the two hashes differ (different zips) and the two locks differ (different torch index)', () => {
    expect(AI_RUNTIME_CATALOGUE.cpu.sha256).not.toBe(AI_RUNTIME_CATALOGUE.cu126.sha256);
    expect(AI_RUNTIME_CATALOGUE.cpu.lockSha256).not.toBe(AI_RUNTIME_CATALOGUE.cu126.lockSha256);
  });

  it('dir names round-trip and staging/tmp names are rejected', () => {
    expect(aiRuntimeDirName('2026.09.1', 'cu126')).toBe('2026.09.1-cu126');
    expect(parseAiRuntimeDirName('2026.09.1-cu126')).toEqual({ version: '2026.09.1', variant: 'cu126' });
    expect(parseAiRuntimeDirName('2026.09.1-cpu')).toEqual({ version: '2026.09.1', variant: 'cpu' });
    expect(parseAiRuntimeDirName('2026.09.1-cpu.tmp')).toBeNull();
    expect(parseAiRuntimeDirName('2026.09.1-rocm')).toBeNull();
    expect(parseAiRuntimeDirName('python')).toBeNull();
    expect(aiRuntimeDownloadId('cpu')).toBe('ai-runtime-cpu');
  });

  it('formats sizes the way the row shows them', () => {
    expect(formatRuntimeBytes(AI_RUNTIME_CATALOGUE.cu126.bytes)).toBe('2.8 GB');
    expect(formatRuntimeBytes(AI_RUNTIME_CATALOGUE.cpu.bytes)).toBe('280 MB');
  });
});
