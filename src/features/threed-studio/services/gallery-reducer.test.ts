import { describe, expect, it } from 'vitest';
import { galleryReducer, INITIAL_GALLERY, toGalleryModel } from './gallery-reducer';
import type { ThreedStudioEntry } from '../../../shared/ipc/types';

function entry(id: string, over: Partial<ThreedStudioEntry> = {}): ThreedStudioEntry {
  return {
    id, name: `model ${id}`, dirName: `m-${id}`, meshFileName: 'mesh.glb', previewFileName: 'preview.png', inputFileName: 'input.png',
    sourceImageName: 'chair.png', sourceImageId: null, model: 'triposr', quality: 256, seed: null, removeBackground: true,
    vertices: 41864, faces: 83732, sizeBytes: 1_675_600, seconds: 30.1, device: 'cuda:0', createdAt: 1, ...over,
  };
}

const base = 'C:\\Users\\x\\AppData\\Roaming\\VidTSX Studio\\threed-studio\\models';

describe('toGalleryModel', () => {
  it('builds file URLs for mesh, preview and input under the model dir', () => {
    const m = toGalleryModel(entry('a'), base);
    expect(m.meshUrl).toBe('file:///C:/Users/x/AppData/Roaming/VidTSX%20Studio/threed-studio/models/m-a/mesh.glb');
    expect(m.previewUrl).toMatch(/m-a\/preview\.png$/);
    expect(m.inputUrl).toMatch(/m-a\/input\.png$/);
    expect(toGalleryModel(entry('b', { previewFileName: null, inputFileName: null }), base)).toMatchObject({ previewUrl: null, inputUrl: null });
  });
});

describe('galleryReducer', () => {
  it('loaded replaces everything, newest first is preserved as given', () => {
    const s = galleryReducer(INITIAL_GALLERY, { type: 'loaded', entries: [entry('2'), entry('1')], basePath: base });
    expect(s.loaded).toBe(true);
    expect(s.entries.map((e) => e.id)).toEqual(['2', '1']);
    expect(s.basePath).toBe(base);
  });

  it('added prepends and ignores duplicates', () => {
    let s = galleryReducer(INITIAL_GALLERY, { type: 'loaded', entries: [entry('1')], basePath: base });
    s = galleryReducer(s, { type: 'added', entry: entry('2') });
    expect(s.entries.map((e) => e.id)).toEqual(['2', '1']);
    const again = galleryReducer(s, { type: 'added', entry: entry('2') });
    expect(again).toBe(s);
  });

  it('removed / removed-many filter by id', () => {
    let s = galleryReducer(INITIAL_GALLERY, { type: 'loaded', entries: [entry('1'), entry('2'), entry('3')], basePath: base });
    s = galleryReducer(s, { type: 'removed', id: '2' });
    expect(s.entries.map((e) => e.id)).toEqual(['1', '3']);
    s = galleryReducer(s, { type: 'removed-many', ids: ['1', 'nope'] });
    expect(s.entries.map((e) => e.id)).toEqual(['3']);
  });
});
