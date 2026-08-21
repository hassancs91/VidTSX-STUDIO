import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ElevenLabsProvider, groupWordsIntoUtterances } from './elevenlabs-provider';
import type { SttWord } from '../types';

let audioPath = '';

beforeAll(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-elevenlabs-test-'));
  audioPath = path.join(dir, 'audio.wav');
  await fs.writeFile(audioPath, Buffer.from('RIFF-fake-wav'));
});

afterAll(async () => {
  await fs.rm(path.dirname(audioPath), { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(payload: unknown, status = 200) {
  const impl = vi.fn(async () => new Response(JSON.stringify(payload), { status }));
  vi.stubGlobal('fetch', impl);
  return impl;
}

function makeRequest(overrides: Partial<Parameters<ElevenLabsProvider['transcribe']>[0]> = {}) {
  return {
    audioPath,
    model: 'scribe_v2',
    signal: new AbortController().signal,
    onProgress: () => {},
    ...overrides,
  };
}

const SCRIBE_RESPONSE = {
  language_code: 'en',
  text: 'Hello world. (laughter)',
  words: [
    { text: 'Hello', type: 'word', start: 0.1, end: 0.4, speaker_id: 'speaker_0' },
    { text: ' ', type: 'spacing', start: 0.4, end: 0.5 },
    { text: 'world.', type: 'word', start: 0.5, end: 0.9, speaker_id: 'speaker_0' },
    { text: '(laughter)', type: 'audio_event', start: 1.0, end: 1.8 },
  ],
};

describe('ElevenLabsProvider.transcribe', () => {
  it('filters spacing and audio_event entries out of the word stream', async () => {
    stubFetch(SCRIBE_RESPONSE);
    const provider = new ElevenLabsProvider('elevenlabs', 'key');
    const result = await provider.transcribe(makeRequest());

    expect(result.words?.map((w) => w.text)).toEqual(['Hello', 'world.']);
    expect(result.result.text).toBe('Hello world. (laughter)');
    expect(result.result.language).toBe('en');
    expect(result.result.segments).toHaveLength(1);
  });

  it('sends one multipart request with the xi-api-key header and model id', async () => {
    const impl = stubFetch(SCRIBE_RESPONSE);
    const provider = new ElevenLabsProvider('elevenlabs', 'secret-key');
    await provider.transcribe(makeRequest({ language: 'en', detectSpeakers: true }));

    expect(impl).toHaveBeenCalledTimes(1);
    const [url, init] = impl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('secret-key');
    const form = init.body as FormData;
    expect(form.get('model_id')).toBe('scribe_v2');
    expect(form.get('language_code')).toBe('en');
    expect(form.get('diarize')).toBe('true');
    expect(form.get('timestamps_granularity')).toBe('word');
  });

  it('omits language_code for auto-detect', async () => {
    const impl = stubFetch(SCRIBE_RESPONSE);
    const provider = new ElevenLabsProvider('elevenlabs', 'key');
    await provider.transcribe(makeRequest({ language: 'auto' }));
    const form = (impl.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.get('language_code')).toBeNull();
  });

  it('maps speaker_id to speaker and snapshots delivered features', async () => {
    stubFetch(SCRIBE_RESPONSE);
    const provider = new ElevenLabsProvider('elevenlabs', 'key');
    const result = await provider.transcribe(makeRequest({ detectSpeakers: true }));

    expect(result.words?.[0]?.speaker).toBe('speaker_0');
    expect(result.features?.speakerLabels).toBe(true);
    expect(result.features?.audioEvents).toBe(true); // the run returned one
    expect(result.features?.verbatimDisfluencies).toBe(false); // held off (Q3)
    expect(result.result.segments[0]?.speaker).toBe('speaker_0');
  });

  it('narrows speakerLabels/audioEvents to what the run delivered', async () => {
    stubFetch({
      language_code: 'en',
      text: 'Hi',
      words: [{ text: 'Hi', type: 'word', start: 0, end: 0.3 }],
    });
    const provider = new ElevenLabsProvider('elevenlabs', 'key');
    const result = await provider.transcribe(makeRequest());
    expect(result.features?.speakerLabels).toBe(false);
    expect(result.features?.audioEvents).toBe(false);
    expect(result.utterances).toBeUndefined();
  });

  it('surfaces a 401 as an API-key problem', async () => {
    stubFetch({ detail: { status: 'invalid_api_key', message: 'nope' } }, 401);
    const provider = new ElevenLabsProvider('elevenlabs', 'bad');
    await expect(provider.transcribe(makeRequest())).rejects.toThrow(
      /ElevenLabs rejected the API key/,
    );
  });

  it('surfaces the API detail message on other errors', async () => {
    stubFetch({ detail: { status: 'too_large', message: 'File too large' } }, 413);
    const provider = new ElevenLabsProvider('elevenlabs', 'key');
    await expect(provider.transcribe(makeRequest())).rejects.toThrow(/File too large/);
  });
});

describe('groupWordsIntoUtterances', () => {
  const word = (
    text: string,
    start: number,
    end: number,
    speaker?: string,
  ): SttWord => ({ text, start, end, ...(speaker ? { speaker } : {}) });

  it('breaks on speaker change and stamps the speaker', () => {
    const utterances = groupWordsIntoUtterances([
      word('Hi', 0, 0.3, 'A'),
      word('there', 0.35, 0.6, 'A'),
      word('Hello', 0.7, 1.0, 'B'),
    ]);
    expect(utterances).toHaveLength(2);
    expect(utterances[0]).toMatchObject({ text: 'Hi there', speaker: 'A' });
    expect(utterances[1]).toMatchObject({ text: 'Hello', speaker: 'B' });
  });

  it('breaks on sentence-ending punctuation and long pauses', () => {
    const utterances = groupWordsIntoUtterances([
      word('Done.', 0, 0.4, 'A'),
      word('Next', 0.5, 0.8, 'A'),
      word('part', 2.5, 2.8, 'A'), // 1.7s gap
    ]);
    expect(utterances.map((u) => u.text)).toEqual(['Done.', 'Next', 'part']);
  });

  it('caps utterance length so captions stay sane', () => {
    const words = Array.from({ length: 30 }, (_, i) =>
      word(`w${i}`, i * 0.3, i * 0.3 + 0.25, 'A'),
    );
    const utterances = groupWordsIntoUtterances(words);
    expect(utterances.length).toBeGreaterThan(1);
    for (const u of utterances) {
      expect(u.text.split(' ').length).toBeLessThanOrEqual(14);
    }
  });
});
