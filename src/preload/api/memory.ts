import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  MemoryListResponse,
  MemorySaveRequest,
  MemorySaveResponse,
  MemorySetActiveRequest,
  MemorySetActiveResponse,
} from '../../shared/ipc/types';

export const memoryApi = {
  // ─── Studio — agent memory (G5) ───
  memoryList: (): Promise<MemoryListResponse> => ipcRenderer.invoke(IPC.MEMORY_LIST),
  memorySave: (data: MemorySaveRequest): Promise<MemorySaveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_SAVE, data),
  memorySetActive: (data: MemorySetActiveRequest): Promise<MemorySetActiveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_SET_ACTIVE, data),
  memoryDelete: (data: MemoryDeleteRequest): Promise<MemoryDeleteResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_DELETE, data),
};
