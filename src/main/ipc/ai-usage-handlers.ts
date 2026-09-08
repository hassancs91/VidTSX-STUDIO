import { aiUsageService } from '../services/ai-usage';
import type {
  AiUsageGetSummaryRequest,
  AiUsageGetSummaryResponse,
  AiUsageGetChartRequest,
  AiUsageGetChartResponse,
  AiUsageGetLogRequest,
  AiUsageGetLogResponse,
  AiUsageGetAgentsRequest,
  AiUsageGetAgentsResponse,
  AiUsageClearResponse,
} from '../../shared/ipc/types';

export async function handleAiUsageGetSummary(
  _event: Electron.IpcMainInvokeEvent,
  data: AiUsageGetSummaryRequest,
): Promise<AiUsageGetSummaryResponse> {
  try {
    const summary = aiUsageService.getSummary({
      startDate: data.startDate,
      endDate: data.endDate,
      provider: data.provider,
    });
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function handleAiUsageGetChart(
  _event: Electron.IpcMainInvokeEvent,
  data: AiUsageGetChartRequest,
): Promise<AiUsageGetChartResponse> {
  try {
    const chartData = aiUsageService.getChartData(
      data.period,
      {
        startDate: data.startDate,
        endDate: data.endDate,
        provider: data.provider,
      },
      data.metric,
    );
    return { success: true, chartData };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function handleAiUsageGetLog(
  _event: Electron.IpcMainInvokeEvent,
  data: AiUsageGetLogRequest,
): Promise<AiUsageGetLogResponse> {
  try {
    const result = aiUsageService.getLog(data.limit, data.offset, {
      provider: data.provider,
      featureSource: data.featureSource,
      ...(data.agentId ? { agentId: data.agentId } : {}),
    });
    return { success: true, entries: result.entries, total: result.total };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function handleAiUsageClear(
  _event: Electron.IpcMainInvokeEvent,
): Promise<AiUsageClearResponse> {
  try {
    await aiUsageService.clear();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function handleAiUsageGetAgents(
  _event: Electron.IpcMainInvokeEvent,
  data: AiUsageGetAgentsRequest,
): Promise<AiUsageGetAgentsResponse> {
  try {
    const agents = aiUsageService.getAgentTotals({
      startDate: data.startDate,
      endDate: data.endDate,
      provider: data.provider,
    });
    return { success: true, agents };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
