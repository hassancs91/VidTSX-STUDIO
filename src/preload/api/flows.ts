import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { FlowRunEvent } from '../../shared/types/flows';
import type {
  FlowsNodesListResponse,
  FlowsRunCancelRequest,
  FlowsRunCancelResponse,
  FlowsRunGetRequest,
  FlowsRunGetResponse,
  FlowsRunReplyRequest,
  FlowsRunReplyResponse,
  FlowsRunResumeRequest,
  FlowsRunResumeResponse,
  FlowsRunStartRequest,
  FlowsRunStartResponse,
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

  // Flows — W8 Stage 1 (docs/flows-plan.md §1.2–§1.3): nodes and main runs
  flowsNodesList: (): Promise<FlowsNodesListResponse> => ipcRenderer.invoke(IPC.FLOWS_NODES_LIST),
  flowsRunStart: (data: FlowsRunStartRequest): Promise<FlowsRunStartResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_START, data),
  flowsRunCancel: (data: FlowsRunCancelRequest): Promise<FlowsRunCancelResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_CANCEL, data),
  flowsRunResume: (data: FlowsRunResumeRequest): Promise<FlowsRunResumeResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_RESUME, data),
  flowsRunGet: (data: FlowsRunGetRequest): Promise<FlowsRunGetResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_GET, data),
  flowsRunReply: (data: FlowsRunReplyRequest): Promise<FlowsRunReplyResponse> =>
    ipcRenderer.invoke(IPC.FLOWS_RUN_REPLY, data),
  onFlowsRunEvent: (callback: (event: FlowRunEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: FlowRunEvent) => callback(data);
    ipcRenderer.on(IPC.FLOWS_RUN_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.FLOWS_RUN_EVENT, listener);
  },
};
