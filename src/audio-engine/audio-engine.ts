import path from 'path';
import type {
  AudioModelDefinition,
  AudioModelType,
  SttSegment,
  SttResult,
  SttPartialResult,
  SttSherpaConfig,
  TtsSherpaConfig,
  TtsRequest,
  TtsResult,
} from './types';
import { AUDIO_MODEL_CATALOG } from './model-registry';

let sherpaModule: unknown = null;
let sherpaLoadAttempted = false;

/**
 * Lazily load the sherpa-onnx-node native addon.
 * Returns null if the addon is not available.
 *
 * In packaged Electron apps, native .node files are extracted outside
 * the asar archive. The companion DLLs (onnxruntime.dll, etc.) live
 * in the same directory as the .node file. On Windows we prepend that
 * directory to PATH so the OS dynamic linker can find them.
 */
function loadSherpa(): unknown {
  if (sherpaLoadAttempted) return sherpaModule;
  sherpaLoadAttempted = true;

  try {
    // Ensure DLLs in the platform-specific package are on PATH (Windows)
    if (process.platform === 'win32') {
      const platform = 'win';
      const arch = process.arch;
      const pkgName = `sherpa-onnx-${platform}-${arch}`;

      // In packaged apps: app.asar.unpacked/node_modules/<pkg>
      // In dev: node_modules/<pkg>
      const possibleDirs = [
        path.join(__dirname, '..', 'node_modules', pkgName),
        path.join(__dirname, '..', '..', 'node_modules', pkgName),
        path.join(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', pkgName),
      ];

      for (const dir of possibleDirs) {
        try {
          require('fs').accessSync(path.join(dir, 'sherpa-onnx.node'));
          const currentPath = process.env.PATH || '';
          if (!currentPath.includes(dir)) {
            process.env.PATH = `${dir};${currentPath}`;
          }
          break;
        } catch {
          // Try next path
        }
      }
    }

    sherpaModule = require('sherpa-onnx-node');
  } catch {
    sherpaModule = null;
  }

  return sherpaModule;
}

/**
 * Build subtitle-style segments from token-level timestamps.
 * Groups tokens into segments split at sentence boundaries (. ? !) or
 * when a segment exceeds ~30 seconds. Falls back to proportional
 * text-based segmentation when token timestamps are not available
 * (common with whisper models in sherpa-onnx offline mode).
 */
function buildSegmentsFromTokens(
  tokens: string[] | undefined,
  timestamps: number[] | undefined,
  fullText: string,
  durationSeconds: number,
): SttSegment[] {
  // If token timestamps are available, use them for precise segments
  if (tokens && timestamps && tokens.length > 0 && timestamps.length > 0) {
    return buildFromTokenTimestamps(tokens, timestamps, durationSeconds);
  }

  // Otherwise, split text into segments with proportional timestamps
  return buildFromTextSplitting(fullText, durationSeconds);
}

function buildFromTokenTimestamps(
  tokens: string[],
  timestamps: number[],
  durationSeconds: number,
): SttSegment[] {
  const MAX_SEGMENT_DURATION = 30;
  const segments: SttSegment[] = [];
  let segStart = timestamps[0];
  let segTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    segTokens.push(token);

    const isSentenceEnd = /[.?!]$/.test(token.trim());
    const segDuration = (timestamps[i] ?? segStart) - segStart;
    const isLast = i === tokens.length - 1;

    if (isSentenceEnd || segDuration >= MAX_SEGMENT_DURATION || isLast) {
      const text = segTokens.join('').trim();
      if (text) {
        const end = i + 1 < timestamps.length ? timestamps[i + 1] : durationSeconds;
        segments.push({ start: segStart, end, text });
      }
      segTokens = [];
      segStart = i + 1 < timestamps.length ? timestamps[i + 1] : durationSeconds;
    }
  }

  return segments.length > 0
    ? segments
    : [{ start: 0, end: durationSeconds, text: segTokens.join('').trim() }];
}

/**
 * Split transcribed text into segments with estimated timestamps.
 * Uses sentence boundaries (. ? ! and newlines) as primary split points,
 * then splits long sentences at commas or word boundaries (~10s max per segment).
 * Timestamps are estimated proportionally by character position.
 */
function buildFromTextSplitting(fullText: string, durationSeconds: number): SttSegment[] {
  const trimmed = fullText.trim();
  if (!trimmed) return [];

  // Split on sentence boundaries while keeping the delimiter
  const rawSentences = trimmed.split(/(?<=[.?!])\s+|(?<=\n)\s*/);
  const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return [{ start: 0, end: durationSeconds, text: trimmed }];
  }

  // Estimate ~10 seconds per segment as target; split long sentences further
  const TARGET_SEGMENT_SECONDS = 10;
  const totalChars = trimmed.length;
  const charsPerSecond = totalChars / (durationSeconds || 1);
  const targetCharsPerSegment = Math.max(40, charsPerSecond * TARGET_SEGMENT_SECONDS);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= targetCharsPerSegment) {
      chunks.push(sentence);
    } else {
      // Split long sentence at commas or by word count
      const parts = sentence.split(/(?<=,)\s+/);
      let current = '';
      for (const part of parts) {
        if (current.length + part.length > targetCharsPerSegment && current.length > 0) {
          chunks.push(current.trim());
          current = part;
        } else {
          current += (current ? ' ' : '') + part;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  // Assign proportional timestamps
  const segments: SttSegment[] = [];
  let charOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const start = (charOffset / totalChars) * durationSeconds;
    charOffset += chunk.length;
    const end = (charOffset / totalChars) * durationSeconds;
    segments.push({ start, end, text: chunk });
  }

  return segments;
}

/**
 * Singleton audio engine managing local STT and TTS via sherpa-onnx.
 * Only instantiated in the Electron main process.
 */
class AudioEngine {
  private modelsBasePath = '';
  private activeSttModelId: string | null = null;
  private activeTtsModelId: string | null = null;
  private sttRecognizer: unknown = null;
  private ttsInstance: unknown = null;
  private streamingStream: unknown = null;
  private decodeInterval: ReturnType<typeof setInterval> | null = null;
  private streamingCallback: ((result: SttPartialResult) => void) | null = null;
  private streamingText = '';

  initialize(modelsBasePath: string): void {
    this.modelsBasePath = modelsBasePath;
  }

  /** Returns true if sherpa-onnx-node native addon loaded successfully. */
  isSherpaAvailable(): boolean {
    return loadSherpa() !== null;
  }

  getModelsBasePath(): string {
    return this.modelsBasePath;
  }

  getModelInfo(modelId: string): AudioModelDefinition | undefined {
    return AUDIO_MODEL_CATALOG.find((m) => m.id === modelId);
  }

  getAvailableModels(type?: AudioModelType): AudioModelDefinition[] {
    const visible = AUDIO_MODEL_CATALOG.filter((m) => !m.hidden);
    if (type) {
      return visible.filter((m) => m.type === type);
    }
    return visible;
  }

  getActiveSttModelId(): string | null {
    return this.activeSttModelId;
  }

  getActiveTtsModelId(): string | null {
    return this.activeTtsModelId;
  }

  // ─── STT ────────────────────────────────────────────────────────────

  loadSttModel(modelId: string, modelPath: string): void {
    const modelDef = this.getModelInfo(modelId);
    if (!modelDef || modelDef.type !== 'stt') {
      throw new Error(`Unknown STT model: ${modelId}`);
    }

    const sherpa = loadSherpa() as Record<string, unknown> | null;
    if (!sherpa) {
      throw new Error('sherpa-onnx-node is not available');
    }

    // Unload previous STT model
    this.unloadStt();

    const config = modelDef.sherpaConfig as SttSherpaConfig;

    if (modelDef.sttMode === 'online') {
      this.sttRecognizer = this.createOnlineRecognizer(sherpa, config, modelPath);
    } else {
      this.sttRecognizer = this.createOfflineRecognizer(sherpa, config, modelPath);
    }

    this.activeSttModelId = modelId;
  }

  private createOfflineRecognizer(
    sherpa: Record<string, unknown>,
    config: SttSherpaConfig,
    modelPath: string,
  ): unknown {
    const OfflineRecognizer = sherpa.OfflineRecognizer as new (cfg: unknown) => unknown;

    const recognizerConfig: Record<string, unknown> = {
      featConfig: { sampleRate: config.sampleRate, featureDim: 80 },
      modelConfig: {
        tokens: path.join(modelPath, config.tokens),
        numThreads: 2,
        debug: false,
      },
    };

    const modelConfig = recognizerConfig.modelConfig as Record<string, unknown>;

    if (config.modelType === 'whisper') {
      modelConfig.whisper = {
        encoder: path.join(modelPath, config.encoder),
        decoder: path.join(modelPath, config.decoder),
      };
    } else if (config.modelType === 'transducer') {
      modelConfig.transducer = {
        encoder: path.join(modelPath, config.encoder),
        decoder: path.join(modelPath, config.decoder),
        joiner: config.joiner ? path.join(modelPath, config.joiner) : undefined,
      };
    } else if (config.modelType === 'paraformer') {
      modelConfig.paraformer = {
        model: path.join(modelPath, config.encoder),
      };
    } else if (config.modelType === 'nemo-ctc') {
      modelConfig.nemoCtc = {
        model: path.join(modelPath, config.encoder),
      };
    }

    return new OfflineRecognizer(recognizerConfig);
  }

  private createOnlineRecognizer(
    sherpa: Record<string, unknown>,
    config: SttSherpaConfig,
    modelPath: string,
  ): unknown {
    const OnlineRecognizer = sherpa.OnlineRecognizer as new (cfg: unknown) => unknown;

    const recognizerConfig: Record<string, unknown> = {
      featConfig: { sampleRate: config.sampleRate, featureDim: 80 },
      modelConfig: {
        tokens: path.join(modelPath, config.tokens),
        numThreads: 2,
        debug: false,
      },
      enableEndpoint: true,
      rule1MinTrailingSilence: 2.4,
      rule2MinTrailingSilence: 1.2,
      rule3MinUtteranceLength: 20,
    };

    const modelConfig = recognizerConfig.modelConfig as Record<string, unknown>;

    if (config.modelType === 'transducer') {
      modelConfig.transducer = {
        encoder: path.join(modelPath, config.encoder),
        decoder: path.join(modelPath, config.decoder),
        joiner: config.joiner ? path.join(modelPath, config.joiner) : undefined,
      };
    } else if (config.modelType === 'paraformer') {
      modelConfig.paraformer = {
        encoder: path.join(modelPath, config.encoder),
        decoder: path.join(modelPath, config.decoder),
      };
    }

    return new OnlineRecognizer(recognizerConfig);
  }

  async transcribeFile(
    audioPath: string,
    onProgress?: (percent: number, message: string) => void,
  ): Promise<SttResult> {
    if (!this.sttRecognizer) {
      throw new Error('No STT model loaded');
    }

    const modelDef = this.getModelInfo(this.activeSttModelId!);
    if (!modelDef) {
      throw new Error('Active STT model not found');
    }

    const sherpa = loadSherpa() as Record<string, unknown>;
    if (!sherpa) {
      throw new Error('sherpa-onnx-node is not available');
    }

    onProgress?.(5, 'Loading audio...');

    const readWave = sherpa.readWave as (path: string, externalBuffer?: boolean) => {
      samples: Float32Array;
      sampleRate: number;
    };
    const wave = readWave(audioPath, false);

    onProgress?.(20, 'Decoding...');

    let result: SttResult;
    if (modelDef.sttMode === 'online') {
      result = this.transcribeWithOnlineRecognizer(wave);
    } else {
      result = this.transcribeWithOfflineRecognizer(wave);
    }

    onProgress?.(100, 'Complete');
    return result;
  }

  private transcribeWithOfflineRecognizer(wave: {
    samples: Float32Array;
    sampleRate: number;
  }): SttResult {
    const recognizer = this.sttRecognizer as {
      createStream: () => {
        acceptWaveform: (obj: { samples: Float32Array; sampleRate: number }) => void;
      };
      decode: (stream: unknown) => void;
      getResult: (stream: unknown) => { text: string; timestamps?: number[]; tokens?: string[] };
    };

    const stream = recognizer.createStream();
    stream.acceptWaveform({ samples: wave.samples, sampleRate: wave.sampleRate });

    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const durationSeconds = wave.samples.length / wave.sampleRate;
    const language = this.getModelInfo(this.activeSttModelId!)?.language ?? 'unknown';

    const segments = buildSegmentsFromTokens(
      result.tokens,
      result.timestamps,
      result.text.trim(),
      durationSeconds,
    );

    return {
      text: result.text.trim(),
      segments,
      language,
      durationSeconds,
    };
  }

  private transcribeWithOnlineRecognizer(wave: {
    samples: Float32Array;
    sampleRate: number;
  }): SttResult {
    const recognizer = this.sttRecognizer as {
      createStream: () => {
        acceptWaveform: (obj: { samples: Float32Array; sampleRate: number }) => void;
        inputFinished: () => void;
      };
      isReady: (stream: unknown) => boolean;
      decode: (stream: unknown) => void;
      isEndpoint: (stream: unknown) => boolean;
      reset: (stream: unknown) => void;
      getResult: (stream: unknown) => { text: string; timestamps?: number[] };
    };

    const stream = recognizer.createStream();
    stream.acceptWaveform({ samples: wave.samples, sampleRate: wave.sampleRate });
    stream.inputFinished();

    const texts: string[] = [];
    while (recognizer.isReady(stream)) {
      recognizer.decode(stream);
      if (recognizer.isEndpoint(stream)) {
        const r = recognizer.getResult(stream);
        if (r.text.trim()) {
          texts.push(r.text.trim());
        }
        recognizer.reset(stream);
      }
    }
    // Get any remaining text
    const finalResult = recognizer.getResult(stream);
    if (finalResult.text.trim()) {
      texts.push(finalResult.text.trim());
    }

    const fullText = texts.join(' ');
    const durationSeconds = wave.samples.length / wave.sampleRate;

    return {
      text: fullText,
      segments: [{
        start: 0,
        end: durationSeconds,
        text: fullText,
      }],
      language: this.getModelInfo(this.activeSttModelId!)?.language ?? 'unknown',
      durationSeconds,
    };
  }

  // ─── Streaming STT ──────────────────────────────────────────────────

  startStreaming(onPartial: (result: SttPartialResult) => void): void {
    if (!this.sttRecognizer) {
      throw new Error('No STT model loaded');
    }

    const modelDef = this.getModelInfo(this.activeSttModelId!);
    if (!modelDef || modelDef.sttMode !== 'online') {
      throw new Error('Streaming requires an online (streaming) STT model');
    }

    this.stopStreaming();

    const recognizer = this.sttRecognizer as {
      createStream: () => unknown;
      isReady: (stream: unknown) => boolean;
      decode: (stream: unknown) => void;
      isEndpoint: (stream: unknown) => boolean;
      reset: (stream: unknown) => void;
      getResult: (stream: unknown) => { text: string };
    };

    this.streamingStream = recognizer.createStream();
    this.streamingCallback = onPartial;
    this.streamingText = '';

    this.decodeInterval = setInterval(() => {
      if (!this.streamingStream) return;

      while (recognizer.isReady(this.streamingStream)) {
        recognizer.decode(this.streamingStream);
      }

      const result = recognizer.getResult(this.streamingStream);
      const isEndpoint = recognizer.isEndpoint(this.streamingStream);

      if (result.text) {
        this.streamingCallback?.({
          text: this.streamingText + result.text,
          isEndpoint,
        });
      }

      if (isEndpoint) {
        if (result.text.trim()) {
          this.streamingText += result.text.trim() + ' ';
        }
        recognizer.reset(this.streamingStream);
      }
    }, 100);
  }

  feedAudioChunk(samples: Float32Array, sampleRate: number): void {
    if (!this.streamingStream) {
      throw new Error('No active streaming session');
    }

    const stream = this.streamingStream as {
      acceptWaveform: (obj: { samples: Float32Array; sampleRate: number }) => void;
    };
    stream.acceptWaveform({ samples, sampleRate });
  }

  stopStreaming(): SttResult {
    if (this.decodeInterval) {
      clearInterval(this.decodeInterval);
      this.decodeInterval = null;
    }

    const text = this.streamingText.trim();
    this.streamingStream = null;
    this.streamingCallback = null;
    this.streamingText = '';

    return {
      text,
      segments: [{ start: 0, end: 0, text }],
      language: this.getModelInfo(this.activeSttModelId!)?.language ?? 'unknown',
      durationSeconds: 0,
    };
  }

  private unloadStt(): void {
    this.stopStreaming();
    this.sttRecognizer = null;
    this.activeSttModelId = null;
  }

  // ─── TTS ────────────────────────────────────────────────────────────

  loadTtsModel(modelId: string, modelPath: string): void {
    const modelDef = this.getModelInfo(modelId);
    if (!modelDef || modelDef.type !== 'tts') {
      throw new Error(`Unknown TTS model: ${modelId}`);
    }

    const sherpa = loadSherpa() as Record<string, unknown> | null;
    if (!sherpa) {
      throw new Error('sherpa-onnx-node is not available');
    }

    // Unload previous TTS model
    this.unloadTts();

    const config = modelDef.sherpaConfig as TtsSherpaConfig;
    const OfflineTts = sherpa.OfflineTts as new (cfg: unknown) => unknown;

    const vitsConfig: Record<string, unknown> = {
      model: path.join(modelPath, config.model),
      tokens: path.join(modelPath, config.tokens),
    };
    if (config.lexicon) vitsConfig.lexicon = path.join(modelPath, config.lexicon);
    if (config.dataDir) vitsConfig.dataDir = path.join(modelPath, config.dataDir);

    const ttsConfig: Record<string, unknown> = {
      model: { vits: vitsConfig },
      numThreads: 2,
    };

    this.ttsInstance = new OfflineTts(ttsConfig);
    this.activeTtsModelId = modelId;
  }

  generateSpeech(request: TtsRequest): TtsResult {
    if (!this.ttsInstance) {
      throw new Error('No TTS model loaded');
    }

    const modelDef = this.getModelInfo(this.activeTtsModelId!);
    if (!modelDef) {
      throw new Error('Active TTS model not found');
    }

    const ttsConfig = modelDef.sherpaConfig as TtsSherpaConfig;
    const tts = this.ttsInstance as {
      sampleRate: number;
      generate: (obj: {
        text: string;
        sid: number;
        speed: number;
        enableExternalBuffer: boolean;
      }) => { samples: Float32Array; sampleRate: number };
    };

    const result = tts.generate({
      text: request.text,
      sid: request.speakerId ?? ttsConfig.defaultSpeakerId,
      speed: request.speed ?? 1.0,
      enableExternalBuffer: false,
    });

    const durationSeconds = result.samples.length / result.sampleRate;

    // Convert Float32Array to WAV buffer
    const wavBuffer = encodeWav(result.samples, result.sampleRate);

    return {
      audioBuffer: wavBuffer,
      sampleRate: result.sampleRate,
      durationSeconds,
    };
  }

  private unloadTts(): void {
    this.ttsInstance = null;
    this.activeTtsModelId = null;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  dispose(): void {
    this.unloadStt();
    this.unloadTts();
  }
}

/** Encode Float32Array PCM samples into a WAV file Buffer. */
function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Convert float32 [-1, 1] to int16
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767;
    buffer.writeInt16LE(Math.round(int16), headerSize + i * 2);
  }

  return buffer;
}

export const audioEngine = new AudioEngine();
