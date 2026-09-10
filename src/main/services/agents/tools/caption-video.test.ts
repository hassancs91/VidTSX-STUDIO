// `caption_video` (W8 Stage 3) with a fake caption entry and render: word
// timings grouped into lines, the burn-in entry built for the clip's size and
// length, the render asked for the self-registering composition, the MP4
// filed and returned as a `video` artifact.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';

let root = '';
let workspace = '';
const upserts: Array<{ relPath: string; description?: string }> = [];

vi.mock('../../../utils/paths', () => ({ getRemotionBinariesDir: () => null, getAssetsDir: () => root, getAppRoot: () => root }));
vi.mock('../../caption-composition', () => ({ createCaptionEntry: async () => { throw new Error('not in tests'); } }));
vi.mock('../../remotion-bundler', () => ({ ensureAssetServerUrl: async () => 'http://127.0.0.1:3100' }));
vi.mock('../../media/remotion-render', () => ({ renderTsxToMp4: async () => { throw new Error('not in tests'); } }));
vi.mock('../../media/ffmpeg-run', () => ({ probeMedia: async () => { throw new Error('not in tests'); } }));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../library/library-store', () => ({
  upsertEntry: async (_r: string, relPath: string, meta: { description?: string }) => {
    upserts.push({ relPath, description: meta.description });
    return { relPath };
  },
}));
vi.mock('../../library/brand-store', () => ({ readBrand: async () => null }));

const { captionVideoTool, captionSegments, setCaptionVideoDepsForTests } = await import('./caption-video');

const WORDS = [
  { text: 'Flows', start: 0.1, end: 0.4 },
  { text: 'run', start: 0.45, end: 0.6 },
  { text: 'in', start: 0.65, end: 0.7 },
  { text: 'main.', start: 0.75, end: 1.0 },
  { text: 'Nodes', start: 2.0, end: 2.3 },
  { text: 'are', start: 2.35, end: 2.5 },
  { text: 'tools', start: 2.55, end: 2.9 },
];

const video: AgentArtifact = {
  id: 'video-1',
  kind: 'video',
  title: 'Talk',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'input_video_file', callId: 'c0' },
  payload: { relPath: 'flows/x/inputs/talk.mp4', durationSeconds: 3, width: 1280, height: 720 },
};
const transcript: AgentArtifact = {
  id: 'document-1',
  kind: 'document',
  title: 'Transcript',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'transcribe', callId: 'c1' },
  payload: {
    relPath: 'transcripts/talk.md',
    transcript: { jsonRelPath: 'transcripts/talk.json', sttModelId: 'assemblyai/universal', durationSeconds: 3, segmentCount: 2, hasWords: true },
  },
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-caption-'));
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-caption-ws-'));
  upserts.length = 0;
  await fs.mkdir(path.join(root, 'flows', 'x', 'inputs'), { recursive: true });
  await fs.writeFile(path.join(root, 'flows', 'x', 'inputs', 'talk.mp4'), 'v');
  await fs.mkdir(path.join(workspace, 'transcripts'), { recursive: true });
  await fs.writeFile(
    path.join(workspace, 'transcripts', 'talk.json'),
    JSON.stringify({ segments: [{ start: 0, end: 1, text: 'Flows run in main.' }, { start: 2, end: 3, text: 'Nodes are tools' }], words: WORDS }),
  );
});

afterEach(async () => {
  setCaptionVideoDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = () => makeToolContext({ artifacts: [video, transcript], workspaceDir: workspace, libraryFolder: 'flows/x', featureSource: 'flows' });

describe('captionSegments', () => {
  it('groups words into lines (punctuation and pauses break), and falls back to the STT segments', () => {
    expect(captionSegments({ words: WORDS }, 3)).toEqual([
      { start: 0.1, end: 0.7, text: 'Flows run in' },
      { start: 0.75, end: 1.0, text: 'main.' },
      { start: 2.0, end: 2.9, text: 'Nodes are tools' },
    ]);
    expect(captionSegments({ segments: [{ start: 0, end: 1, text: ' a ' }, { start: 1, end: 2, text: '  ' }] }, 4)).toEqual([{ start: 0, end: 1, text: 'a' }]);
  });
});

describe('caption_video', () => {
  it('builds a burn-in entry for the clip, renders it in main, files and returns the captioned video', async () => {
    const entries: Array<Record<string, unknown>> = [];
    const renders: Array<Record<string, unknown>> = [];
    let cleaned = 0;
    setCaptionVideoDepsForTests({
      probe: async (p) => ({ duration: p.endsWith('talk.mp4') ? 3 : 3.04, width: 1280, height: 720, fps: 25, hasVideo: true, hasAudio: true }),
      assetServerUrl: async () => 'http://127.0.0.1:4123',
      createEntry: async (config) => {
        entries.push({ ...config });
        return { entryPath: path.join(workspace, 'entry.tsx'), cleanup: async () => { cleaned += 1; } };
      },
      render: async (o) => {
        renders.push({ entryPath: o.entryPath, skipWrapper: o.skipWrapper, compositionId: o.compositionId, outputPath: o.outputPath, durationInFrames: o.durationInFrames });
        o.onProgress?.('rendering', 50);
        await fs.writeFile(o.outputPath, 'mp4');
        return { outputPath: o.outputPath, fileSize: 3, width: 1280, height: 720, fps: 25, durationInFrames: 75 };
      },
    });
    const res = await captionVideoTool.handler({ video: 'video-1', transcript: 'document-1', style: 'karaoke', wordsPerGroup: 3 }, ctx());
    expect(res.isError, res.content[0].text).toBeUndefined();
    expect(entries[0]).toMatchObject({
      styleId: 'karaoke',
      mode: 'burnin',
      compositionId: 'captions-karaoke-burnin',
      width: 1280,
      height: 720,
      fps: 25,
      durationInFrames: 75,
      videoPath: path.join(root, 'flows', 'x', 'inputs', 'talk.mp4'),
      bundlerPort: 4123,
    });
    expect((entries[0].segments as unknown[]).length).toBe(3);
    expect(renders[0]).toEqual({
      entryPath: path.join(workspace, 'entry.tsx'),
      skipWrapper: true,
      compositionId: 'captions-karaoke-burnin',
      outputPath: path.join(root, 'flows', 'x', 'talk-captioned.mp4'),
      durationInFrames: 75,
    });
    expect(cleaned).toBe(1);
    expect(res.artifact).toEqual({
      kind: 'video',
      title: 'Talk (captioned)',
      payload: { relPath: 'flows/x/talk-captioned.mp4', durationSeconds: 3.04, width: 1280, height: 720, hasAudio: true },
    });
    expect(upserts[0]).toMatchObject({ relPath: 'flows/x/talk-captioned.mp4', description: 'Captioned: Talk' });
  });

  it('refuses a transcript artifact that is a plain document, and cleans up after a failed render', async () => {
    const plain: AgentArtifact = { ...transcript, id: 'document-2', payload: { relPath: 'notes.md' } };
    const res = await captionVideoTool.handler({ video: 'video-1', transcript: 'document-2' }, makeToolContext({ artifacts: [video, plain], workspaceDir: workspace }));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('not a transcript');

    let cleaned = 0;
    setCaptionVideoDepsForTests({
      probe: async () => ({ duration: 3, width: 1280, height: 720, fps: 25, hasVideo: true, hasAudio: true }),
      assetServerUrl: async () => 'http://127.0.0.1:4123',
      createEntry: async () => ({ entryPath: 'e.tsx', cleanup: async () => { cleaned += 1; } }),
      render: async () => { throw new Error('Chromium crashed'); },
    });
    const failed = await captionVideoTool.handler({ video: 'video-1', transcript: 'document-1' }, ctx());
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toContain('Chromium crashed');
    expect(cleaned).toBe(1);
  });
});
