import { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import {
  isWhisperInstalled,
  getWhisperBinaryPath,
  getAvailableModels,
  downloadWhisperBinary,
  deleteModel,
  transcribe,
  cancelTranscription,
  getModelPath,
  getModelsDir,
  MODEL_URL_BASE,
} from '../services/whisper';
import { enqueueDownload } from '../services/download-manager';
import type {
  WhisperBinaryStatusResponse,
  WhisperBinaryInstallResponse,
  WhisperModelsListResponse,
  WhisperModelDownloadRequest,
  WhisperModelDownloadResponse,
  WhisperModelDeleteRequest,
  WhisperModelDeleteResponse,
  WhisperProgressEvent,
  WhisperTranscribeRequest,
  WhisperTranscribeResponse,
  WhisperTranscribeCancelResponse,
} from '../../shared/ipc/types';

export async function handleWhisperBinaryStatus(): Promise<WhisperBinaryStatusResponse> {
  return {
    installed: isWhisperInstalled(),
    path: getWhisperBinaryPath(),
  };
}

export async function handleWhisperBinaryInstall(
  event: IpcMainInvokeEvent
): Promise<WhisperBinaryInstallResponse> {
  try {
    const webContents = event.sender;

    await downloadWhisperBinary((progress) => {
      if (!webContents.isDestroyed()) {
        const progressEvent: WhisperProgressEvent = {
          type: 'binary',
          percent: progress.percent,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
        };
        webContents.send(IPC.WHISPER_PROGRESS, progressEvent);
      }
    });

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to install Whisper binary';
    return { success: false, error };
  }
}

export async function handleWhisperModelsList(): Promise<WhisperModelsListResponse> {
  try {
    const models = await getAvailableModels();
    return { models };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list whisper models';
    return { models: [], error };
  }
}

export async function handleWhisperModelDownload(
  event: IpcMainInvokeEvent,
  data: WhisperModelDownloadRequest
): Promise<WhisperModelDownloadResponse> {
  try {
    if (!data.modelId) {
      return { success: false, error: 'Model ID is required' };
    }

    const modelFileName = data.modelId === 'large-v3' ? 'ggml-large-v3.bin' : `ggml-${data.modelId}.bin`;
    const modelUrl = `${MODEL_URL_BASE}/${modelFileName}`;
    const destPath = getModelPath(data.modelId);

    // Ensure models directory exists
    const modelsDir = getModelsDir();
    const fs = await import('fs/promises');
    await fs.mkdir(modelsDir, { recursive: true });

    await enqueueDownload(
      {
        id: `whisper-model-${data.modelId}`,
        url: modelUrl,
        destPath,
        metadata: { modelId: data.modelId, type: 'whisper-model' },
      },
      (progress) => {
        if (!event.sender.isDestroyed()) {
          const progressEvent: WhisperProgressEvent = {
            type: 'model',
            modelId: data.modelId,
            percent: progress.percent,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          };
          event.sender.send(IPC.WHISPER_PROGRESS, progressEvent);
        }
      },
    );

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to download model';
    return { success: false, error };
  }
}

export async function handleWhisperModelDelete(
  _event: IpcMainInvokeEvent,
  data: WhisperModelDeleteRequest
): Promise<WhisperModelDeleteResponse> {
  try {
    if (!data.modelId) {
      return { success: false, error: 'Model ID is required' };
    }

    await deleteModel(data.modelId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete model';
    return { success: false, error };
  }
}

export async function handleWhisperTranscribe(
  event: IpcMainInvokeEvent,
  data: WhisperTranscribeRequest
): Promise<WhisperTranscribeResponse> {
  try {
    if (!data.inputPath) {
      return { success: false, error: 'Input path is required' };
    }
    if (!data.modelId) {
      return { success: false, error: 'Model ID is required' };
    }

    const webContents = event.sender;

    const result = await transcribe(
      {
        inputPath: data.inputPath,
        modelId: data.modelId,
        language: data.language,
      },
      (phase, percent, message) => {
        if (!webContents.isDestroyed()) {
          webContents.send(IPC.WHISPER_TRANSCRIBE_PROGRESS, {
            phase,
            percent,
            message,
          });
        }
      }
    );

    return { success: true, result };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Transcription failed';
    return { success: false, error };
  }
}

export async function handleWhisperTranscribeCancel(): Promise<WhisperTranscribeCancelResponse> {
  const cancelled = cancelTranscription();
  return { success: cancelled };
}

export const whisperHandlers = {
  handleWhisperBinaryStatus,
  handleWhisperBinaryInstall,
  handleWhisperModelsList,
  handleWhisperModelDownload,
  handleWhisperModelDelete,
  handleWhisperTranscribe,
  handleWhisperTranscribeCancel,
};
