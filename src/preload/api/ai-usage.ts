import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  AiUsageClearResponse,
  AiUsageGetChartRequest,
  AiUsageGetChartResponse,
  AiUsageGetLogRequest,
  AiUsageGetLogResponse,
  AiUsageGetSummaryRequest,
  AiUsageGetSummaryResponse,
} from '../../shared/ipc/types';

export const aiUsageApi = {
  // ─── AI Usage tracking ───
  // AI Usage tracking
  aiUsageGetSummary: (data: AiUsageGetSummaryRequest): Promise<AiUsageGetSummaryResponse> =>
    ipcRenderer.invoke(IPC.AI_USAGE_GET_SUMMARY, data),
  aiUsageGetChart: (data: AiUsageGetChartRequest): Promise<AiUsageGetChartResponse> =>
    ipcRenderer.invoke(IPC.AI_USAGE_GET_CHART, data),
  aiUsageGetLog: (data: AiUsageGetLogRequest): Promise<AiUsageGetLogResponse> =>
    ipcRenderer.invoke(IPC.AI_USAGE_GET_LOG, data),
  aiUsageClear: (): Promise<AiUsageClearResponse> =>
    ipcRenderer.invoke(IPC.AI_USAGE_CLEAR),
};
