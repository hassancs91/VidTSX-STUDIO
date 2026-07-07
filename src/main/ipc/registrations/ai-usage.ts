import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleAiUsageGetSummary,
  handleAiUsageGetChart,
  handleAiUsageGetLog,
  handleAiUsageClear,
} from '../ai-usage-handlers';

export function registerAiUsageIpc(): void {
  ipcMain.handle(IPC.AI_USAGE_GET_SUMMARY, handleAiUsageGetSummary);
  ipcMain.handle(IPC.AI_USAGE_GET_CHART, handleAiUsageGetChart);
  ipcMain.handle(IPC.AI_USAGE_GET_LOG, handleAiUsageGetLog);
  ipcMain.handle(IPC.AI_USAGE_CLEAR, handleAiUsageClear);
}
