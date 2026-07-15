import type { IpcMainInvokeEvent } from 'electron';
import { app } from 'electron';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipc/channels';
import { getRemotionBinariesDir } from '../utils/paths';

const WAV_EXTENSIONS = new Set(['.wav']);

/**
 * Convert any audio/video file to 16kHz mono WAV for sherpa-onnx.
 * Returns the original path if already .wav, otherwise a temp WAV path.
 */
async function ensureWav(inputPath: string): Promise<{ wavPath: string; isTemp: boolean }> {
  const ext = path.extname(inputPath).toLowerCase();
  if (WAV_EXTENSIONS.has(ext)) {
    return { wavPath: inputPath, isTemp: false };
  }

  const tempDir = path.join(app.getPath('temp'), 'vidtsx-audio');
  await fs.mkdir(tempDir, { recursive: true });
  const wavPath = path.join(tempDir, `convert-${Date.now()}.wav`);

  const { RenderInternals } = await import('@remotion/renderer');
  const ffmpegExe = RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegExe, [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y', wavPath,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && existsSync(wavPath)) resolve();
      else reject(new Error(`FFmpeg conversion failed (code ${code}): ${stderr.slice(-300)}`));
    });
    proc.on('error', (err) => reject(new Error(`Failed to start FFmpeg: ${err.message}`)));
  });

  return { wavPath, isTemp: true };
}
import type {
  AudioStatusResponse,
  AudioModelsListRequest,
  AudioModelsListResponse,
  AudioModelDownloadRequest,
  AudioModelDownloadResponse,
  AudioModelDeleteRequest,
  AudioModelDeleteResponse,
  AudioSttLoadModelRequest,
  AudioSttLoadModelResponse,
  AudioSttTranscribeRequest,
  AudioSttTranscribeResponse,
  AudioSttStreamStartResponse,
  AudioSttStreamFeedRequest,
  AudioSttStreamFeedResponse,
  AudioSttStreamStopResponse,
  AudioTtsLoadModelRequest,
  AudioTtsLoadModelResponse,
  AudioTtsGenerateRequest,
  AudioTtsGenerateResponse,
  AudioSettingsGetResponse,
  AudioSettingsSaveRequest,
  AudioSettingsSaveResponse,
  AudioModelIpc,
} from '../../shared/ipc/types';
import { audioEngine } from '../../audio-engine';
import { AUDIO_MODEL_CATALOG } from '../../audio-engine/model-registry';
import type { TtsSherpaConfig } from '../../audio-engine/types';
import {
  isModelDownloaded,
  deleteModel,
  getModelDir,
  getAudioModelsDir,
} from '../services/audio-models';
import { enqueueDownload } from '../services/download-manager';
import { getAudioSettings, saveAudioSettings } from '../services/settings';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AudioHandlers');

export async function handleAudioStatus(
  _event: IpcMainInvokeEvent,
): Promise<AudioStatusResponse> {
  const available = audioEngine.isSherpaAvailable();
  let version: string | undefined;
  if (available) {
    try {
      const sherpa = require('sherpa-onnx-node') as { version?: string };
      version = sherpa.version;
    } catch {
      // ignore
    }
  }
  return {
    available,
    version,
    activeSttModelId: audioEngine.getActiveSttModelId(),
    activeTtsModelId: audioEngine.getActiveTtsModelId(),
  };
}

export async function handleAudioModelsList(
  _event: IpcMainInvokeEvent,
  data?: AudioModelsListRequest,
): Promise<AudioModelsListResponse> {
  try {
    const models = audioEngine.getAvailableModels(data?.type);
    const result: AudioModelIpc[] = models.map((m) => {
      const downloaded = isModelDownloaded(m.id);
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        sttMode: m.sttMode,
        language: m.language,
        sizeLabel: m.sizeLabel,
        sizeBytes: m.sizeBytes,
        downloaded,
        numSpeakers: m.sherpaConfig.type === 'tts'
          ? (m.sherpaConfig as TtsSherpaConfig).numSpeakers
          : undefined,
        modelPath: downloaded ? getModelDir(m.id) : undefined,
      };
    });
    return { models: result };
  } catch {
    return { models: [] };
  }
}

export async function handleAudioModelDownload(
  event: IpcMainInvokeEvent,
  data: AudioModelDownloadRequest,
): Promise<AudioModelDownloadResponse> {
  try {
    const model = AUDIO_MODEL_CATALOG.find((m) => m.id === data.modelId);
    if (!model) {
      log.warn('Unknown audio model requested', { modelId: data.modelId });
      return { success: false, error: `Unknown model: ${data.modelId}` };
    }

    log.info('Downloading audio model', { modelId: data.modelId, name: model.name });

    const typeDir = path.join(getAudioModelsDir(), model.type);
    const archiveFileName = path.basename(model.downloadPath);
    const archivePath = path.join(typeDir, archiveFileName);
    const downloadUrl = model.downloadPath;

    await enqueueDownload(
      {
        id: `audio-model-${data.modelId}`,
        url: downloadUrl,
        destPath: archivePath,
        extraction: {
          format: model.archiveFormat,
          destDir: typeDir,
          deleteArchive: true,
        },
        metadata: { modelId: data.modelId, type: 'audio-model' },
      },
      (progress) => {
        event.sender.send(IPC.AUDIO_DOWNLOAD_PROGRESS, {
          modelId: data.modelId,
          percent: progress.percent,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
        });
      },
    );

    log.info('Audio model download complete', { modelId: data.modelId });
    return { success: true };
  } catch (err) {
    log.error('Audio model download failed', err, { modelId: data.modelId });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleAudioModelDelete(
  _event: IpcMainInvokeEvent,
  data: AudioModelDeleteRequest,
): Promise<AudioModelDeleteResponse> {
  try {
    await deleteModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

export async function handleAudioSttLoadModel(
  _event: IpcMainInvokeEvent,
  data: AudioSttLoadModelRequest,
): Promise<AudioSttLoadModelResponse> {
  try {
    const modelPath = getModelDir(data.modelId);
    audioEngine.loadSttModel(data.modelId, modelPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load STT model',
    };
  }
}

export async function handleAudioSttTranscribe(
  event: IpcMainInvokeEvent,
  data: AudioSttTranscribeRequest,
): Promise<AudioSttTranscribeResponse> {
  let tempWav: string | null = null;
  try {
    const webContents = event.sender;

    const sendProgress = (percent: number, message: string) => {
      if (!webContents.isDestroyed()) {
        webContents.send(IPC.AUDIO_STT_TRANSCRIBE_PROGRESS, { percent, message });
      }
    };

    sendProgress(0, 'Converting audio...');
    const { wavPath, isTemp } = await ensureWav(data.inputPath);
    if (isTemp) tempWav = wavPath;

    const result = await audioEngine.transcribeFile(wavPath, sendProgress);
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Transcription failed',
    };
  } finally {
    if (tempWav) await fs.unlink(tempWav).catch(() => {});
  }
}

export async function handleAudioSttStreamStart(
  event: IpcMainInvokeEvent,
): Promise<AudioSttStreamStartResponse> {
  try {
    audioEngine.startStreaming((partial) => {
      event.sender.send(IPC.AUDIO_STT_PARTIAL, partial);
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start streaming',
    };
  }
}

export async function handleAudioSttStreamFeed(
  _event: IpcMainInvokeEvent,
  data: AudioSttStreamFeedRequest,
): Promise<AudioSttStreamFeedResponse> {
  try {
    const buffer = Buffer.from(data.samplesBase64, 'base64');
    const samples = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    audioEngine.feedAudioChunk(samples, data.sampleRate);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function handleAudioSttStreamStop(
  _event: IpcMainInvokeEvent,
): Promise<AudioSttStreamStopResponse> {
  try {
    const result = audioEngine.stopStreaming();
    return {
      success: true,
      result: {
        text: result.text,
        segments: result.segments,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to stop streaming',
    };
  }
}

export async function handleAudioTtsLoadModel(
  _event: IpcMainInvokeEvent,
  data: AudioTtsLoadModelRequest,
): Promise<AudioTtsLoadModelResponse> {
  try {
    const modelPath = getModelDir(data.modelId);
    audioEngine.loadTtsModel(data.modelId, modelPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load TTS model',
    };
  }
}

export async function handleAudioTtsGenerate(
  _event: IpcMainInvokeEvent,
  data: AudioTtsGenerateRequest,
): Promise<AudioTtsGenerateResponse> {
  try {
    const result = audioEngine.generateSpeech({
      text: data.text,
      speakerId: data.speakerId,
      speed: data.speed,
    });
    return {
      success: true,
      audioBase64: result.audioBuffer.toString('base64'),
      sampleRate: result.sampleRate,
      durationSeconds: result.durationSeconds,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'TTS generation failed',
    };
  }
}

export async function handleAudioSettingsGet(
  _event: IpcMainInvokeEvent,
): Promise<AudioSettingsGetResponse> {
  try {
    return await getAudioSettings();
  } catch {
    return { activeSttModelId: null, activeTtsModelId: null };
  }
}

export async function handleAudioSettingsSave(
  _event: IpcMainInvokeEvent,
  data: AudioSettingsSaveRequest,
): Promise<AudioSettingsSaveResponse> {
  try {
    await saveAudioSettings(data.activeSttModelId, data.activeTtsModelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save settings',
    };
  }
}
