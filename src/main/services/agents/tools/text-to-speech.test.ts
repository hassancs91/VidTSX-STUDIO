// `text_to_speech` (W8 Stage 3) with a fake engine: the "needs a voice"
// refusals, the load-on-demand, the WAV filed as an `audio` artifact.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { makeToolContext } from './test-context';

let root = '';
const upserts: Array<{ relPath: string; description?: string }> = [];

vi.mock('../../../../audio-engine', () => ({ audioEngine: {} }));
vi.mock('../../../../audio-engine/model-registry', () => ({
  AUDIO_MODEL_CATALOG: [
    { id: 'sherpa-tts-vits-ljs-en', name: 'VITS LJSpeech (en)', type: 'tts' },
    { id: 'sherpa-stt-x', name: 'STT', type: 'stt' },
  ],
}));
vi.mock('../../audio-init', () => ({ ensureAudioEngine: async () => {} }));
vi.mock('../../audio-models', () => ({ getModelDir: (id: string) => `/models/${id}`, isModelDownloaded: () => false }));
vi.mock('../../settings', () => ({ getAudioSettings: async () => ({ activeSttModelId: null, activeTtsModelId: null }) }));
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

const { textToSpeechTool, setTextToSpeechDepsForTests, NO_TTS_VOICE_MESSAGE } = await import('./text-to-speech');

let loaded: string | null = null;
const loads: string[] = [];

function fakeDeps(over: Partial<Parameters<typeof setTextToSpeechDepsForTests>[0] & object> = {}) {
  return {
    ensureEngine: async () => {},
    activeModelId: async () => 'sherpa-tts-vits-ljs-en',
    isDownloaded: () => true,
    loadedModelId: () => loaded,
    load: (id: string) => {
      loads.push(id);
      loaded = id;
    },
    generate: (req: { text: string; speakerId?: number; speed?: number }) => ({
      audioBuffer: Buffer.from(`WAV:${req.text}:${req.speakerId ?? '-'}:${req.speed ?? '-'}`),
      sampleRate: 22050,
      durationSeconds: 1.5,
    }),
    ...over,
  };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-tts-'));
  upserts.length = 0;
  loads.length = 0;
  loaded = null;
});

afterEach(async () => {
  setTextToSpeechDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = () => makeToolContext({ libraryFolder: 'flows/x', featureSource: 'flows' });

describe('text_to_speech', () => {
  it('declares the text → audio ports with the catalog voices in the inspector', () => {
    expect(textToSpeechTool.ports?.inputs.map((p) => p.dataType)).toEqual(['text']);
    expect(textToSpeechTool.ports?.outputs[0]).toMatchObject({ id: 'audio', dataType: 'audio' });
    const voice = textToSpeechTool.ports?.configSchema.find((f) => f.key === 'modelId');
    expect(voice?.kind === 'select' ? voice.options.map((o) => o.value) : []).toEqual(['', 'sherpa-tts-vits-ljs-en']);
  });

  it('answers the needs-a-voice message when no voice is active or downloaded, without generating', async () => {
    setTextToSpeechDepsForTests(fakeDeps({ activeModelId: async () => null }));
    const none = await textToSpeechTool.handler({ text: 'hello' }, ctx());
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toBe(NO_TTS_VOICE_MESSAGE);
    setTextToSpeechDepsForTests(fakeDeps({ isDownloaded: () => false }));
    const missing = await textToSpeechTool.handler({ text: 'hello', modelId: 'sherpa-tts-vits-ljs-en' }, ctx());
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('is not downloaded');
    expect(upserts).toEqual([]);
  });

  it('loads the voice once, generates, files the WAV and returns a speech audio artifact', async () => {
    setTextToSpeechDepsForTests(fakeDeps());
    const res = await textToSpeechTool.handler({ text: 'Hello there, flows.', speakerId: 2, speed: 1.1, title: 'Intro' }, ctx());
    expect(res.isError).toBeUndefined();
    expect(loads).toEqual(['sherpa-tts-vits-ljs-en']);
    expect(await fs.readFile(path.join(root, 'flows', 'x', 'speech-intro.wav'), 'utf-8')).toBe('WAV:Hello there, flows.:2:1.1');
    expect(res.artifact).toEqual({
      kind: 'audio',
      title: 'Intro',
      payload: { relPath: 'flows/x/speech-intro.wav', durationSeconds: 1.5, sound: 'speech' },
    });
    expect(upserts[0]).toMatchObject({ relPath: 'flows/x/speech-intro.wav', description: 'Hello there, flows.' });
    // A second call on the same voice does not reload it.
    await textToSpeechTool.handler({ text: 'again' }, ctx());
    expect(loads).toEqual(['sherpa-tts-vits-ljs-en']);
  });

  it('relays an engine failure as an error result', async () => {
    setTextToSpeechDepsForTests(fakeDeps({ generate: () => { throw new Error('No TTS model loaded'); } }));
    const res = await textToSpeechTool.handler({ text: 'x' }, ctx());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('No TTS model loaded');
  });
});
