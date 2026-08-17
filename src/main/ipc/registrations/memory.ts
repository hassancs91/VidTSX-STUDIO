import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleMemoryDelete,
  handleMemoryList,
  handleMemoryProposalResolve,
  handleMemoryProposalsGet,
  handleMemorySave,
  handleMemorySetActive,
} from '../memory-handlers';

export function registerMemoryIpc(): void {
  ipcMain.handle(IPC.MEMORY_LIST, handleMemoryList);
  ipcMain.handle(IPC.MEMORY_SAVE, handleMemorySave);
  ipcMain.handle(IPC.MEMORY_SET_ACTIVE, handleMemorySetActive);
  ipcMain.handle(IPC.MEMORY_DELETE, handleMemoryDelete);
  ipcMain.handle(IPC.MEMORY_PROPOSALS_GET, handleMemoryProposalsGet);
  ipcMain.handle(IPC.MEMORY_PROPOSAL_RESOLVE, handleMemoryProposalResolve);
}
