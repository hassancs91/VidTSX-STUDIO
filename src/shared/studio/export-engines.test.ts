import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPORT_ENGINE_ID,
  EXPORT_ENGINES,
  exportEngineDefinition,
  isExportEngineId,
  normalizeExportEngineId,
} from './export-engines';

describe('export-engine catalogue', () => {
  it('ships the Remotion path as the default (D2)', () => {
    expect(DEFAULT_EXPORT_ENGINE_ID).toBe('remotion');
    expect(EXPORT_ENGINES[0].id).toBe(DEFAULT_EXPORT_ENGINE_ID);
  });

  it('keeps engine names internal (D3): labels never say Remotion or passthrough', () => {
    for (const e of EXPORT_ENGINES) {
      expect(`${e.label} ${e.description}`).not.toMatch(/remotion|passthrough/i);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it('normalises unknown or missing ids to the default (the settings boundary)', () => {
    expect(normalizeExportEngineId(undefined)).toBe(DEFAULT_EXPORT_ENGINE_ID);
    expect(normalizeExportEngineId('nope')).toBe(DEFAULT_EXPORT_ENGINE_ID);
    expect(normalizeExportEngineId(42)).toBe(DEFAULT_EXPORT_ENGINE_ID);
    expect(normalizeExportEngineId('remotion')).toBe('remotion');
    expect(isExportEngineId('remotion')).toBe(true);
    expect(isExportEngineId('')).toBe(false);
  });

  it('resolves a definition by id and throws for an unknown one', () => {
    expect(exportEngineDefinition('remotion').id).toBe('remotion');
    expect(() => exportEngineDefinition('x' as never)).toThrow(/Unknown export engine/);
  });
});
