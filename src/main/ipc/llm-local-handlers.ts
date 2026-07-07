import { randomUUID } from 'crypto';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LocalLlmStatusResponse,
  LocalLlmModelsListResponse,
  LocalLlmModelDownloadRequest,
  LocalLlmModelDownloadResponse,
  LocalLlmModelDeleteRequest,
  LocalLlmModelDeleteResponse,
  LocalLlmLoadModelRequest,
  LocalLlmLoadModelResponse,
  LocalLlmUnloadModelResponse,
  LocalLlmGenerateRequest,
  LocalLlmGenerateResponse,
  LocalLlmChatRequest,
  LocalLlmChatResponse,
  LocalLlmCancelResponse,
  LocalLlmSessionClearRequest,
  LocalLlmSessionClearResponse,
  LocalLlmGpuInfoResponse,
  LocalLlmSettingsGetResponse,
  LocalLlmSettingsSaveRequest,
  LocalLlmSettingsSaveResponse,
  LocalLlmModelIpc,
} from '../../shared/ipc/types';
import { llmLocalEngine } from '../../llm-engine';
import {
  isModelDownloaded,
  downloadLlmModel,
  deleteLlmModel,
  getModelFilePath,
} from '../services/llm-local-models';
import { getLocalLlmSettings, saveLocalLlmSettings } from '../services/settings';
import { aiUsageService } from '../services/ai-usage';

export async function handleLocalLlmStatus(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmStatusResponse> {
  return {
    available: await llmLocalEngine.isAvailable(),
    activeModelId: llmLocalEngine.getActiveModelId(),
    gpu: llmLocalEngine.getGpuInfo(),
  };
}

export async function handleLocalLlmModelsList(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmModelsListResponse> {
  const models = llmLocalEngine.getAvailableModels();
  const result: LocalLlmModelIpc[] = models.map((m) => ({
    id: m.id,
    name: m.name,
    family: m.family,
    parameterCount: m.parameterCount,
    quantization: m.quantization,
    contextLength: m.contextLength,
    sizeLabel: m.sizeLabel,
    sizeBytes: m.sizeBytes,
    description: m.description,
    capabilities: m.capabilities,
    releaseDate: m.releaseDate,
    downloaded: isModelDownloaded(m.id),
  }));
  return { models: result };
}

export async function handleLocalLlmModelDownload(
  _event: IpcMainInvokeEvent,
  data: LocalLlmModelDownloadRequest,
): Promise<LocalLlmModelDownloadResponse> {
  try {
    // Uses the shared download manager (pause/resume/cancel via download-handlers)
    await downloadLlmModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleLocalLlmModelDelete(
  _event: IpcMainInvokeEvent,
  data: LocalLlmModelDeleteRequest,
): Promise<LocalLlmModelDeleteResponse> {
  try {
    // Unload if this is the active model
    if (llmLocalEngine.getActiveModelId() === data.modelId) {
      await llmLocalEngine.unloadModel();
    }
    await deleteLlmModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

export async function handleLocalLlmLoadModel(
  _event: IpcMainInvokeEvent,
  data: LocalLlmLoadModelRequest,
): Promise<LocalLlmLoadModelResponse> {
  try {
    const modelFilePath = getModelFilePath(data.modelId);
    await llmLocalEngine.loadModel(data.modelId, modelFilePath);
    await saveLocalLlmSettings(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load model',
    };
  }
}

export async function handleLocalLlmUnloadModel(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmUnloadModelResponse> {
  try {
    await llmLocalEngine.unloadModel();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unload model',
    };
  }
}

export async function handleLocalLlmGenerate(
  event: IpcMainInvokeEvent,
  data: LocalLlmGenerateRequest,
): Promise<LocalLlmGenerateResponse> {
  try {
    const requestId = randomUUID();

    if (data.stream) {
      // Streaming mode: return requestId immediately, send tokens via events
      const onToken = (tokenEvent: { requestId: string; token: string; text: string }) => {
        event.sender.send(IPC.LOCAL_LLM_TOKEN, tokenEvent);
      };

      // Run generation async — don't await
      llmLocalEngine
        .generateCompletion(requestId, {
          prompt: data.prompt,
          params: {
            temperature: data.temperature,
            topP: data.topP,
            topK: data.topK,
            maxTokens: data.maxTokens,
            repeatPenalty: data.repeatPenalty,
            seed: data.seed,
            stop: data.stop,
            responseFormat: data.responseFormat,
          },
          stream: true,
        }, onToken)
        .then((result) => {
          event.sender.send(IPC.LOCAL_LLM_COMPLETE, { requestId, result });
        })
        .catch((err) => {
          event.sender.send(IPC.LOCAL_LLM_COMPLETE, {
            requestId,
            result: {
              text: '',
              tokensGenerated: 0,
              tokensPerSecond: 0,
              stopReason: 'cancelled',
              error: err instanceof Error ? err.message : 'Generation failed',
            },
          });
        });

      return { success: true, requestId };
    }

    // Non-streaming mode: wait for result
    const genStart = Date.now();
    const result = await llmLocalEngine.generateCompletion(requestId, {
      prompt: data.prompt,
      params: {
        temperature: data.temperature,
        topP: data.topP,
        topK: data.topK,
        maxTokens: data.maxTokens,
        repeatPenalty: data.repeatPenalty,
        seed: data.seed,
        stop: data.stop,
        responseFormat: data.responseFormat,
      },
    });

    // Log usage (fire-and-forget)
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: 'local-llm',
      model: llmLocalEngine.getActiveModelId() || 'local',
      featureSource: 'other',
      inputTokens: 0,
      outputTokens: result.tokensGenerated ?? 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - genStart,
      requestType: 'local-llm',
    }).catch(() => {});

    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    };
  }
}

export async function handleLocalLlmChat(
  event: IpcMainInvokeEvent,
  data: LocalLlmChatRequest,
): Promise<LocalLlmChatResponse> {
  try {
    const requestId = randomUUID();

    if (data.stream) {
      const onToken = (tokenEvent: { requestId: string; token: string; text: string }) => {
        event.sender.send(IPC.LOCAL_LLM_TOKEN, tokenEvent);
      };

      llmLocalEngine
        .generateChat(requestId, {
          messages: data.messages,
          sessionId: data.sessionId,
          params: {
            temperature: data.temperature,
            topP: data.topP,
            topK: data.topK,
            maxTokens: data.maxTokens,
            repeatPenalty: data.repeatPenalty,
            seed: data.seed,
            stop: data.stop,
            responseFormat: data.responseFormat,
          },
          stream: true,
        }, onToken)
        .then((result) => {
          event.sender.send(IPC.LOCAL_LLM_COMPLETE, { requestId, result });
        })
        .catch((err) => {
          event.sender.send(IPC.LOCAL_LLM_COMPLETE, {
            requestId,
            result: {
              text: '',
              tokensGenerated: 0,
              tokensPerSecond: 0,
              stopReason: 'cancelled',
              error: err instanceof Error ? err.message : 'Chat failed',
            },
          });
        });

      return { success: true, requestId, sessionId: data.sessionId };
    }

    const chatStart = Date.now();
    const result = await llmLocalEngine.generateChat(requestId, {
      messages: data.messages,
      sessionId: data.sessionId,
      params: {
        temperature: data.temperature,
        topP: data.topP,
        topK: data.topK,
        maxTokens: data.maxTokens,
        repeatPenalty: data.repeatPenalty,
        seed: data.seed,
        stop: data.stop,
        responseFormat: data.responseFormat,
      },
    });

    // Log usage (fire-and-forget)
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: 'local-llm',
      model: llmLocalEngine.getActiveModelId() || 'local',
      featureSource: 'ai-chat',
      inputTokens: 0,
      outputTokens: result.tokensGenerated ?? 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - chatStart,
      requestType: 'local-llm',
    }).catch(() => {});

    return { success: true, result, sessionId: result.sessionId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Chat failed',
    };
  }
}

export async function handleLocalLlmCancel(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmCancelResponse> {
  llmLocalEngine.cancelGeneration();
  return { success: true };
}

export async function handleLocalLlmSessionClear(
  _event: IpcMainInvokeEvent,
  data: LocalLlmSessionClearRequest,
): Promise<LocalLlmSessionClearResponse> {
  if (data.sessionId) {
    llmLocalEngine.clearSession(data.sessionId);
  } else {
    llmLocalEngine.clearAllSessions();
  }
  return { success: true };
}

export async function handleLocalLlmGpuInfo(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmGpuInfoResponse> {
  const info = await llmLocalEngine.detectGpu();
  return info;
}

export async function handleLocalLlmSettingsGet(
  _event: IpcMainInvokeEvent,
): Promise<LocalLlmSettingsGetResponse> {
  try {
    return await getLocalLlmSettings();
  } catch {
    return { activeModelId: null };
  }
}

export async function handleLocalLlmSettingsSave(
  _event: IpcMainInvokeEvent,
  data: LocalLlmSettingsSaveRequest,
): Promise<LocalLlmSettingsSaveResponse> {
  try {
    await saveLocalLlmSettings(data.activeModelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save settings',
    };
  }
}
