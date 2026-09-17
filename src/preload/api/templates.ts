import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  TemplatesListResponse,
  TemplatesStageRequest,
  TemplatesStageResponse,
  TemplatesStateLoadRequest,
  TemplatesStateLoadResponse,
  TemplatesStateSaveRequest,
  TemplatesStateSaveResponse,
} from '../../shared/ipc/types';

export const templatesApi = {
  templatesList: (): Promise<TemplatesListResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_LIST),
  templatesStage: (data: TemplatesStageRequest): Promise<TemplatesStageResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STAGE, data),
  templatesStateLoad: (data: TemplatesStateLoadRequest): Promise<TemplatesStateLoadResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STATE_LOAD, data),
  templatesStateSave: (data: TemplatesStateSaveRequest): Promise<TemplatesStateSaveResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STATE_SAVE, data),
};
