import { describe, it, expect } from 'vitest';
import { toVideoModelInfo } from './model-info';
import { getVideoModel } from '../shared/presets/video-models';
import type { VideoModelCatalogEntry } from '../shared/presets/video-models';

function entry(id: string): VideoModelCatalogEntry {
  const found = getVideoModel(id);
  if (!found) throw new Error(`no catalog entry for ${id}`);
  return found;
}

describe('toVideoModelInfo — seed capability', () => {
  it('reports no seed for a family that takes none (Seedance 2.x)', () => {
    expect(toVideoModelInfo(entry('seedance-2.5')).supports.seed).toBe(false);
    expect(toVideoModelInfo(entry('dreamina-seedance-2-5-260628')).supports.seed).toBe(false);
  });

  it('reports a seed where the entry says nothing — the dialect sends one', () => {
    const kling = entry('kling-2.5-turbo-pro');
    expect(kling.supportsSeed).toBeUndefined();
    expect(toVideoModelInfo(kling).supports.seed).toBe(true);
  });
});
