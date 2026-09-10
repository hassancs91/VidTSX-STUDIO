// `transcribe` (W8 Stage 3) against a fake STT pipeline: the brand's
// vocabulary primes the call as keyterms, the alias post-pass corrects the
// words, the usage source is the runner's, and the result is a `document`
// artifact whose payload names the JSON with the timings.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import type { SttRichResult } from '../../../../transcription-engine/types';
import { makeToolContext } from './test-context';

let root = '';
let workspace = '';

vi.mock('../../stt/run-transcription', () => ({ transcribeAudioFile: async () => { throw new Error('not in tests'); } }));
vi.mock('../../stt/extract-audio', () => ({
  extractAudioToWav: async () => { throw new Error('not in tests'); },
  isAudioFile: (p: string) => /\.(wav|mp3|m4a|flac|ogg|aac|opus)$/i.test(p),
}));
vi.mock('../../studio/agent-memory', () => ({ listMemories: async () => [] }));
vi.mock('../../library/brand-store', () => ({ readBrand: async () => null }));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));

const { transcribeTool, setTranscribeDepsForTests } = await import('./transcribe');

const video: AgentArtifact = {
  id: 'video-1',
  kind: 'video',
  title: 'Talk',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'input_video_file', callId: 'c0' },
  payload: { relPath: 'flows/x/inputs/talk.mp4', durationSeconds: 3 },
};
const audio: AgentArtifact = {
  id: 'audio-1',
  kind: 'audio',
  title: 'Voice',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'text_to_speech', callId: 'c0' },
  payload: { relPath: 'flows/x/speech.wav', durationSeconds: 3, sound: 'speech' },
};

const RICH = {
  result: {
    language: 'en',
    duration: 3.2,
    text: 'Welcome to vid tsx studio.',
    segments: [{ start: 0, end: 3.2, text: 'Welcome to vid tsx studio.' }],
  },
  words: [
    { text: 'Welcome', start: 0, end: 0.4 },
    { text: 'to', start: 0.45, end: 0.55 },
    { text: 'vid', start: 0.6, end: 0.8 },
    { text: 'tsx', start: 0.85, end: 1.1 },
    { text: 'studio.', start: 1.2, end: 1.6 },
  ],
} as unknown as SttRichResult;

let calls: Array<Record<string, unknown>> = [];
let extracted: string[] = [];

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-stt-'));
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-stt-ws-'));
  calls = [];
  extracted = [];
  await fs.mkdir(path.join(root, 'flows', 'x', 'inputs'), { recursive: true });
  await fs.writeFile(path.join(root, 'flows', 'x', 'inputs', 'talk.mp4'), 'v');
  await fs.writeFile(path.join(root, 'flows', 'x', 'speech.wav'), 'w');
  setTranscribeDepsForTests({
    transcribe: async (params) => {
      calls.push({ audioPath: params.audioPath, sttModelId: params.sttModelId, keyterms: params.keyterms, featureSource: params.featureSource, language: params.language });
      params.onProgress(50, 'Transcribing');
      return RICH;
    },
    extractAudio: async (inputPath) => {
      const wav = path.join(workspace, 'extracted.wav');
      await fs.writeFile(wav, 'x');
      extracted.push(inputPath);
      return wav;
    },
    brandVocabulary: async (brandId) => (brandId === 'acme' ? [{ term: 'VidTSX', aliases: ['vid tsx'] }, { term: 'Hasan' }] : []),
    memories: async () => [],
  });
});

afterEach(async () => {
  setTranscribeDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = (artifacts: AgentArtifact[], brandId?: string) =>
  makeToolContext({ artifacts, workspaceDir: workspace, libraryFolder: 'flows/x', featureSource: 'flows', ...(brandId ? { brandId } : {}) });

describe('transcribe', () => {
  it('extracts audio from a video, primes the brand vocabulary, files the transcript document + JSON, cleans the WAV', async () => {
    const res = await transcribeTool.handler({ video: 'video-1', title: 'Talk transcript' }, ctx([video], 'acme'));
    expect(res.isError, res.content[0].text).toBeUndefined();
    expect(extracted).toEqual([path.join(root, 'flows', 'x', 'inputs', 'talk.mp4')]);
    expect(calls[0]).toMatchObject({
      audioPath: path.join(workspace, 'extracted.wav'),
      sttModelId: 'assemblyai/universal',
      keyterms: ['VidTSX', 'Hasan'],
      featureSource: 'flows',
      language: undefined,
    });
    await expect(fs.access(path.join(workspace, 'extracted.wav'))).rejects.toThrow();

    expect(res.artifact).toEqual({
      kind: 'document',
      title: 'Talk transcript',
      payload: {
        relPath: 'transcripts/talk-transcript.md',
        transcript: { jsonRelPath: 'transcripts/talk-transcript.json', sttModelId: 'assemblyai/universal', language: 'en', durationSeconds: 3.2, segmentCount: 1, hasWords: true },
      },
    });
    const json = JSON.parse(await fs.readFile(path.join(workspace, 'transcripts', 'talk-transcript.json'), 'utf-8'));
    // The alias post-pass wrote the brand's spelling into the text and the words.
    expect(json.text).toBe('Welcome to VidTSX studio.');
    expect(json.words.map((w: { text: string }) => w.text)).toEqual(['Welcome', 'to', 'VidTSX', 'studio.']);
    expect(json.keytermCount).toBe(2);
    expect(res.fields).toEqual({ text: 'Welcome to VidTSX studio.' });
    const md = await fs.readFile(path.join(workspace, 'transcripts', 'talk-transcript.md'), 'utf-8');
    expect(md).toContain('# Talk transcript');
    expect(md).toContain('**[00:00]** Welcome to VidTSX studio.');
  });

  it('takes an audio artifact as-is (no extraction), no keyterms without a brand, the chosen model and language', async () => {
    const res = await transcribeTool.handler({ audio: 'audio-1', sttModelId: 'assemblyai/universal-2', language: 'en' }, ctx([audio]));
    expect(res.isError).toBeUndefined();
    expect(extracted).toEqual([]);
    expect(calls[0]).toMatchObject({ audioPath: path.join(root, 'flows', 'x', 'speech.wav'), sttModelId: 'assemblyai/universal-2', language: 'en' });
    expect(calls[0].keyterms).toBeUndefined();
    expect(res.artifact?.title).toBe('Transcript — Voice');
  });

  it('refuses nothing to transcribe, an unknown model and a text-only model', async () => {
    expect((await transcribeTool.handler({}, ctx([]))).content[0].text).toContain('Connect a video or an audio');
    expect((await transcribeTool.handler({ video: 'video-1', sttModelId: 'nope/x' }, ctx([video]))).isError).toBe(true);
    const plain = await transcribeTool.handler({ video: 'video-1', sttModelId: 'openrouter/openai/whisper-1' }, ctx([video]));
    expect(plain.content[0].text).toContain('without timestamps');
    expect(calls).toEqual([]);
  });

  it('relays a provider failure as an error result', async () => {
    setTranscribeDepsForTests({
      transcribe: async () => { throw new Error('Transcription provider "assemblyai" is not configured.'); },
      extractAudio: async () => path.join(workspace, 'x.wav'),
      brandVocabulary: async () => [],
      memories: async () => [],
    });
    const res = await transcribeTool.handler({ audio: 'audio-1' }, ctx([audio]));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('is not configured');
  });
});
