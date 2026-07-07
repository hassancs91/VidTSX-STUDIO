// ─── Flows (node-graph builder) — projects ───
export interface FlowProjectSummary {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  galleryFolderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FlowProject extends FlowProjectSummary {
  graphJson: string;
}

export interface FlowProjectListResponse {
  success: boolean;
  projects?: FlowProjectSummary[];
  error?: string;
}

export interface FlowProjectCreateRequest {
  name: string;
  description?: string;
  graphJson?: string;
}

export interface FlowProjectCreateResponse {
  success: boolean;
  project?: FlowProject;
  error?: string;
}

export interface FlowProjectLoadRequest {
  id: string;
}

export interface FlowProjectLoadResponse {
  success: boolean;
  project?: FlowProject;
  error?: string;
}

export interface FlowProjectUpdateRequest {
  id: string;
  name?: string;
  description?: string | null;
  graphJson?: string;
  thumbnail?: string | null;
}

export interface FlowProjectUpdateResponse {
  success: boolean;
  project?: FlowProject;
  error?: string;
}

export interface FlowProjectDeleteRequest {
  id: string;
}

export interface FlowProjectDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Flows — run history (Phase 5) ───
export type FlowRunStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface FlowRunSummary {
  id: string;
  flowId: string;
  status: FlowRunStatus;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
}

export interface FlowRunRecord extends FlowRunSummary {
  // JSON string keyed by nodeId — { status, output?, error?, durationMs? }
  nodeResults: string;
}

export interface FlowRunPersistRequest {
  id: string;
  flowId: string;
  status: FlowRunStatus;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  nodeResults: string;
}

export interface FlowRunPersistResponse {
  success: boolean;
  run?: FlowRunRecord;
  error?: string;
}

export interface FlowRunListRequest {
  flowId: string;
}

export interface FlowRunListResponse {
  success: boolean;
  runs?: FlowRunSummary[];
  error?: string;
}

export interface FlowRunLoadRequest {
  id: string;
}

export interface FlowRunLoadResponse {
  success: boolean;
  run?: FlowRunRecord;
  error?: string;
}
