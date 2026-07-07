import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  FlowProjectCreateRequest,
  FlowProjectCreateResponse,
  FlowProjectDeleteRequest,
  FlowProjectDeleteResponse,
  FlowProjectListResponse,
  FlowProjectLoadRequest,
  FlowProjectLoadResponse,
  FlowProjectUpdateRequest,
  FlowProjectUpdateResponse,
  FlowRunPersistRequest,
  FlowRunPersistResponse,
  FlowRunListRequest,
  FlowRunListResponse,
  FlowRunLoadRequest,
  FlowRunLoadResponse,
} from '../../shared/ipc/types';

export const flowsApi = {
  // ─── Flows (node-graph builder) projects ───
  // Flows (node-graph builder) projects
  flowsProjectList: (): Promise<FlowProjectListResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_PROJECT_LIST),
  flowsProjectCreate: (data: FlowProjectCreateRequest): Promise<FlowProjectCreateResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_PROJECT_CREATE, data),
  flowsProjectLoad: (data: FlowProjectLoadRequest): Promise<FlowProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_PROJECT_LOAD, data),
  flowsProjectUpdate: (data: FlowProjectUpdateRequest): Promise<FlowProjectUpdateResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_PROJECT_UPDATE, data),
  flowsProjectDelete: (data: FlowProjectDeleteRequest): Promise<FlowProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_PROJECT_DELETE, data),

  // Flows — run history (Phase 5)
  flowsRunPersist: (data: FlowRunPersistRequest): Promise<FlowRunPersistResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_PERSIST, data),
  flowsRunList: (data: FlowRunListRequest): Promise<FlowRunListResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_LIST, data),
  flowsRunLoad: (data: FlowRunLoadRequest): Promise<FlowRunLoadResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_LOAD, data),
};
