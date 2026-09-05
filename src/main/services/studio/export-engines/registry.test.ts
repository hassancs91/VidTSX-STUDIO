import { beforeEach, describe, expect, it } from 'vitest';
import {
  fallbackExportEngineId,
  hasExportEngine,
  listExportEngineIds,
  listExportEngineStatus,
  registerExportEngine,
  resetExportEnginesForTests,
  resolveExportEngine,
} from './registry';
import type { ExportEngine } from './types';

const fake = (id: string, available = true, reason = 'needs the full ffmpeg download'): ExportEngine => ({
  id: id as ExportEngine['id'],
  availability: async () => (available ? { available: true } : { available: false, reason }),
  produce: async () => ({ videoPath: 'x' }),
});

describe('export-engine registry', () => {
  beforeEach(() => resetExportEnginesForTests());

  it('registers only catalogue ids, once', () => {
    registerExportEngine(fake('remotion'));
    expect(hasExportEngine('remotion')).toBe(true);
    expect(() => registerExportEngine(fake('remotion'))).toThrow(/already registered/);
    expect(() => registerExportEngine(fake('mystery'))).toThrow(/not in the catalogue/);
  });

  it('resolves a registered engine and refuses an unknown one loudly', () => {
    registerExportEngine(fake('remotion'));
    expect(resolveExportEngine('remotion').id).toBe('remotion');
    expect(() => resolveExportEngine('passthrough')).toThrow(/not available in this build/);
    expect(() => resolveExportEngine('')).toThrow();
  });

  it('lists registered engines in catalogue order with their availability', async () => {
    expect(listExportEngineIds()).toEqual([]);
    registerExportEngine(fake('remotion', false, 'no binary'));
    expect(listExportEngineIds()).toEqual(['remotion']);
    expect(await listExportEngineStatus()).toEqual([{ id: 'remotion', available: false, unavailableReason: 'no binary' }]);
  });

  it('turns an availability probe that throws into an unavailable row', async () => {
    registerExportEngine({
      ...fake('remotion'),
      availability: async () => {
        throw new Error('probe exploded');
      },
    });
    expect(await listExportEngineStatus()).toEqual([{ id: 'remotion', available: false, unavailableReason: 'probe exploded' }]);
  });

  it('falls back to the catalogue default', () => {
    expect(fallbackExportEngineId()).toBe('remotion');
  });
});
