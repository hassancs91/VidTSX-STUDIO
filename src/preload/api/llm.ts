import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LlmCancelRequest,
  LlmCancelResponse,
  LlmChatGenerateRequest,
  LlmChatGenerateResponse,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmProviderTestRequest,
  LlmProviderTestResponse,
  LlmProvidersGetResponse,
  LlmProvidersSaveRequest,
  LlmProvidersSaveResponse,
} from '../../shared/ipc/types';

export const llmApi = {
  // ─── LLM operations ───
  // LLM operations
  llmProvidersGet: (): Promise<LlmProvidersGetResponse> =>
    ipcRenderer.invoke(IPC.LLM_PROVIDERS_GET),
  llmProvidersSave: (data: LlmProvidersSaveRequest): Promise<LlmProvidersSaveResponse> =>
    ipcRenderer.invoke(IPC.LLM_PROVIDERS_SAVE, data),
  llmProviderTest: (data: LlmProviderTestRequest): Promise<LlmProviderTestResponse> =>
    ipcRenderer.invoke(IPC.LLM_PROVIDER_TEST, data),
  llmGenerate: (data: LlmGenerateRequest): Promise<LlmGenerateResponse> =>
    ipcRenderer.invoke(IPC.LLM_GENERATE, data),
  llmChatGenerate: (data: LlmChatGenerateRequest): Promise<LlmChatGenerateResponse> =>
    ipcRenderer.invoke(IPC.LLM_CHAT_GENERATE, data),
  llmCancel: (data?: LlmCancelRequest): Promise<LlmCancelResponse> =>
    ipcRenderer.invoke(IPC.LLM_CANCEL, data),
};
