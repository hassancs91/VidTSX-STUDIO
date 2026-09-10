// The four flow input resolvers (flows plan §1.2, W8 Stage 1) against fake
// services: the library root is a temp dir, the gallery and Video Studio
// lookups are replaced through their seams, ffprobe is a stub.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { makeToolContext } from './test-context';

let root = '';
const upserts: Array<{ relPath: string; origin: string; description?: string }> = [];

vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../library/library-store', () => ({
  upsertEntry: async (_r: string, relPath: string, meta: { origin: string; description?: string }) => {
    upserts.push({ relPath, origin: meta.origin, description: meta.description });
    return { relPath };
  },
}));
vi.mock('../../image-studio-db', () => ({ getImageEntry: () => null, getImageFilePath: () => null }));
vi.mock('../../video-studio-db', () => ({ getVideoFilePath: async () => null }));
vi.mock('../../frame-extractor', () => ({ probeVideo: async () => ({ duration: 0, width: 0, height: 0 }) }));

const { inputTextTool } = await import('./input-text');
const { inputImageFileTool } = await import('./input-image-file');
const { inputImageLibraryTool, setImageLibraryLookupForTests } = await import('./input-image-library');
const { inputVideoFileTool, setVideoInputDepsForTests } = await import('./input-video-file');

// A 2x3 PNG header (IHDR only) is enough for the dimension reader.
function pngBytes(width: number, height: number): Buffer {
  const b = Buffer.alloc(33, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-inputs-'));
  upserts.length = 0;
});

afterEach(async () => {
  setImageLibraryLookupForTests(null);
  setVideoInputDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true });
});

const ctx = () => makeToolContext({ libraryFolder: 'flows/test-flow', featureSource: 'flows' });

describe('input_text', () => {
  it('emits its text on the field the port reads, and refuses empty text', async () => {
    const res = await inputTextTool.handler({ text: 'a red fox' }, ctx());
    expect(res.isError).toBeUndefined();
    expect(res.fields).toEqual({ text: 'a red fox' });
    expect((await inputTextTool.handler({ text: '   ' }, ctx())).isError).toBe(true);
  });
});

describe('input_image_file', () => {
  it('writes the base64 into <libraryFolder>/inputs, indexes it as imported, returns an image-set', async () => {
    const res = await inputImageFileTool.handler(
      { base64: pngBytes(640, 360).toString('base64'), fileName: 'Hero Shot.png', contentType: 'image/png' },
      ctx(),
    );
    expect(res.isError).toBeUndefined();
    expect(res.artifact?.kind).toBe('image-set');
    if (res.artifact?.kind !== 'image-set') throw new Error('expected image-set');
    const [item] = res.artifact.payload.items;
    expect(item.relPath).toBe('flows/test-flow/inputs/hero-shot.png');
    expect(item).toMatchObject({ width: 640, height: 360 });
    await expect(fs.stat(path.join(root, item.relPath))).resolves.toBeTruthy();
    expect(upserts).toEqual([{ relPath: item.relPath, origin: 'imported', description: 'Hero Shot.png' }]);
  });

  it('copies from an absolute path when given one, and refuses with nothing', async () => {
    const src = path.join(root, 'pick.jpg');
    await fs.writeFile(src, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const res = await inputImageFileTool.handler({ filePath: src }, ctx());
    expect(res.isError).toBeUndefined();
    if (res.artifact?.kind !== 'image-set') throw new Error('expected image-set');
    expect(res.artifact.payload.items[0].relPath).toBe('flows/test-flow/inputs/pick.jpg');
    expect((await inputImageFileTool.handler({}, ctx())).isError).toBe(true);
  });
});

describe('input_image_library', () => {
  it('copies the gallery file into the run folder — never links it', async () => {
    const galleryFile = path.join(root, 'gallery-abc.png');
    await fs.writeFile(galleryFile, pngBytes(1024, 768));
    setImageLibraryLookupForTests({
      entry: (id) =>
        id === 'abc'
          ? { fileName: 'gallery-abc.png', prompt: 'a calm lake', width: null, height: null, contentType: 'image/png' }
          : null,
      filePath: (id) => (id === 'abc' ? galleryFile : null),
    });
    const res = await inputImageLibraryTool.handler({ entryId: 'abc' }, ctx());
    expect(res.isError).toBeUndefined();
    if (res.artifact?.kind !== 'image-set') throw new Error('expected image-set');
    const [item] = res.artifact.payload.items;
    expect(item.relPath).toBe('flows/test-flow/inputs/a-calm-lake.png');
    expect(item).toMatchObject({ width: 1024, height: 768 });
    // The copy stands on its own once the gallery file is gone.
    await fs.rm(galleryFile);
    await expect(fs.stat(path.join(root, item.relPath))).resolves.toBeTruthy();
  });

  it('names a missing entry and an empty pick', async () => {
    expect((await inputImageLibraryTool.handler({ entryId: '' }, ctx())).isError).toBe(true);
    const gone = await inputImageLibraryTool.handler({ entryId: 'nope' }, ctx());
    expect(gone.isError).toBe(true);
    expect(gone.content[0].text).toContain('nope');
  });
});

describe('input_video_file', () => {
  it('copies a clip by path, probes it, and returns a video artifact', async () => {
    const clip = path.join(root, 'My Clip.mp4');
    await fs.writeFile(clip, Buffer.from('not really mp4'));
    setVideoInputDepsForTests({
      entryPath: async () => null,
      probe: async () => ({ duration: 4.5, width: 1920, height: 1080 }),
    });
    const res = await inputVideoFileTool.handler({ filePath: clip }, ctx());
    expect(res.isError).toBeUndefined();
    if (res.artifact?.kind !== 'video') throw new Error('expected video');
    expect(res.artifact.payload).toEqual({
      relPath: 'flows/test-flow/inputs/my-clip.mp4',
      durationSeconds: 4.5,
      width: 1920,
      height: 1080,
    });
    expect(upserts[0]).toMatchObject({ origin: 'imported', description: 'My Clip.mp4' });
  });

  it('resolves a Video Studio entry id and refuses non-video files', async () => {
    const clip = path.join(root, 'entry.mov');
    await fs.writeFile(clip, Buffer.from('mov'));
    setVideoInputDepsForTests({
      entryPath: async (id) => (id === 'v1' ? clip : null),
      probe: async () => ({ duration: 1, width: 10, height: 10 }),
    });
    const res = await inputVideoFileTool.handler({ entryId: 'v1' }, ctx());
    expect(res.artifact?.kind).toBe('video');
    expect((await inputVideoFileTool.handler({ entryId: 'v2' }, ctx())).isError).toBe(true);
    const notVideo = path.join(root, 'notes.txt');
    await fs.writeFile(notVideo, 'x');
    expect((await inputVideoFileTool.handler({ filePath: notVideo }, ctx())).isError).toBe(true);
    expect((await inputVideoFileTool.handler({}, ctx())).isError).toBe(true);
  });
});
