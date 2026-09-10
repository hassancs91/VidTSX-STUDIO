// `text_to_speech` — text to a WAV through the local sherpa-onnx voice
// (flows plan §1.2, W8 Stage 3), the same `audioEngine.generateSpeech` the
// `AUDIO_TTS_GENERATE` handler calls. Free and offline; the only requirement
// is a downloaded voice model, so a machine without one gets the same
// "needs a voice" message the Voice AI Tester shows, never a crash. The
// speech is filed in the asset library as an `audio` artifact (`sound: 'speech'`).

import fs from 'fs/promises';
import { z } from 'zod';
import { AUDIO_MODEL_CATALOG } from '../../../../audio-engine/model-registry';
import type { TtsRequest, TtsResult } from '../../../../audio-engine/types';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, reserveLibraryOutput } from './port-media';

// The engine, the model folder and the settings are imported on first use:
// `audio-models.ts` resolves `app.getPath('userData')` at load, and the tool
// registry is imported by code (and tests) that run without Electron.
const engine = () => import('../../../../audio-engine');
const models = () => import('../../audio-models');

export const NO_TTS_VOICE_MESSAGE =
  'No voice model is installed — download one in Tools → Voice AI Tester (or Settings → Audio) and pick it in the inspector.';

const schema = {
  text: z.string().min(1).describe('What to say.'),
  modelId: z.string().optional().describe('A downloaded sherpa TTS model id; absent = the active voice in Settings → Audio.'),
  speakerId: z.coerce.number().int().min(0).optional().describe('Speaker index for multi-speaker voices.'),
  speed: z.coerce.number().min(0.5).max(2).optional().describe('1 = normal.'),
  title: z.string().optional().describe('Names the clip.'),
};

interface TextToSpeechArgs {
  text: string;
  modelId?: string;
  speakerId?: number;
  speed?: number;
  title?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface TextToSpeechDeps {
  ensureEngine(): Promise<void>;
  activeModelId(): Promise<string | null>;
  isDownloaded(modelId: string): MaybePromise<boolean>;
  loadedModelId(): MaybePromise<string | null>;
  load(modelId: string): MaybePromise<void>;
  generate(req: TtsRequest): MaybePromise<TtsResult>;
}

const defaultDeps: TextToSpeechDeps = {
  ensureEngine: async () => (await import('../../audio-init')).ensureAudioEngine(),
  async activeModelId() {
    const { getAudioSettings } = await import('../../settings');
    const settings = await getAudioSettings();
    return settings.activeTtsModelId ?? (await engine()).audioEngine.getActiveTtsModelId();
  },
  isDownloaded: async (id) => (await models()).isModelDownloaded(id),
  loadedModelId: async () => (await engine()).audioEngine.getActiveTtsModelId(),
  load: async (id) => (await engine()).audioEngine.loadTtsModel(id, (await models()).getModelDir(id)),
  generate: async (req) => (await engine()).audioEngine.generateSpeech(req),
};

let deps: TextToSpeechDeps = defaultDeps;
export function setTextToSpeechDepsForTests(next: TextToSpeechDeps | null): void {
  deps = next ?? defaultDeps;
}

const VOICES = AUDIO_MODEL_CATALOG.filter((m) => m.type === 'tts' && !m.hidden).map((m) => ({ value: m.id, label: m.name }));

export const textToSpeechTool: AgentToolDef<TextToSpeechArgs> = {
  id: 'text_to_speech',
  description:
    'Turn text into speech with the local voice model (sherpa-onnx, free, offline) and file the WAV in the asset library. Returns an "audio" artifact. Needs a downloaded voice model.',
  schema,
  ports: {
    label: 'Text to Speech',
    category: 'audio',
    inputs: [{ id: 'text', label: 'Text', dataType: 'text', required: true, argKey: 'text' }],
    outputs: [{ id: 'audio', label: 'Speech', dataType: 'audio', from: 'artifact' }],
    configSchema: [
      { kind: 'select', key: 'modelId', label: 'Voice', options: [{ value: '', label: 'Active voice (Settings → Audio)' }, ...VOICES] },
      { kind: 'number', key: 'speakerId', label: 'Speaker', min: 0, max: 999, step: 1 },
      { kind: 'number', key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.1 },
      { kind: 'text', key: 'title', label: 'Title', placeholder: 'Speech' },
    ],
    defaultConfig: { modelId: '', speakerId: 0, speed: 1, title: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const text = args.text.trim();
    if (!text) return toolText('The text is empty.', true);
    try {
      await deps.ensureEngine();
    } catch (err) {
      return toolText(`The audio engine is unavailable: ${err instanceof Error ? err.message : String(err)}`, true);
    }
    const modelId = args.modelId?.trim() || (await deps.activeModelId());
    if (!modelId) return toolText(NO_TTS_VOICE_MESSAGE, true);
    if (!(await deps.isDownloaded(modelId))) return toolText(`${NO_TTS_VOICE_MESSAGE} ("${modelId}" is not downloaded.)`, true);
    try {
      if ((await deps.loadedModelId()) !== modelId) {
        ctx.emitProgress(`Loading voice ${modelId}`);
        await deps.load(modelId);
      }
      ctx.emitProgress(text.slice(0, 60));
      const result = await deps.generate({
        text,
        ...(args.speakerId !== undefined ? { speakerId: args.speakerId } : {}),
        ...(args.speed !== undefined ? { speed: args.speed } : {}),
      });
      const title = args.title?.trim() || text.slice(0, 40);
      const { relPath, absPath } = await reserveLibraryOutput({ libraryFolder: ctx.libraryFolder, baseName: `speech-${title}`, ext: '.wav' });
      await fs.writeFile(absPath, result.audioBuffer);
      await indexLibraryOutput(relPath, text.slice(0, 200), ctx.brandId);
      return {
        ...toolText(`Speech ready: ${relPath} (${result.durationSeconds.toFixed(1)} s, ${modelId}).`),
        artifact: {
          kind: 'audio',
          title: title.slice(0, 80),
          payload: { relPath, durationSeconds: result.durationSeconds, sound: 'speech' },
        },
      };
    } catch (err) {
      return toolText(`Speech generation failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
