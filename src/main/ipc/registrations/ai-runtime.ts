import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleAiRuntimeInstall,
  handleAiRuntimeRemove,
  handleAiRuntimeRepair,
  handleAiRuntimeStatus,
  initAiRuntimeStatusBroadcast,
} from '../ai-runtime-handlers';

export function registerAiRuntimeIpc(): void {
  ipcMain.handle(IPC.AI_RUNTIME_STATUS, handleAiRuntimeStatus);
  ipcMain.handle(IPC.AI_RUNTIME_INSTALL, handleAiRuntimeInstall);
  ipcMain.handle(IPC.AI_RUNTIME_REPAIR, handleAiRuntimeRepair);
  ipcMain.handle(IPC.AI_RUNTIME_REMOVE, handleAiRuntimeRemove);
  initAiRuntimeStatusBroadcast();
}
