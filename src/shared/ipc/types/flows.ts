import type {
  FlowDoc,
  FlowOrigin,
  FlowRunDoc,
  FlowRunEvent,
  FlowRunMode,
  FlowSource,
  NodeSpec,
} from '../../types/flows';
import type { InteractionReply } from '../../types/agents';

// ─── Flows (node-graph builder) — projects ───
export interface FlowProjectSummary {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  galleryFolderId: string | null;
  createdAt: number;
  updatedAt: number;
  /** W8 Stage 0: the stored document's format (rows migrate to 2 on open). */
  docVersion: number;
  origin: FlowOrigin | null;
  source: FlowSource;
}

export interface FlowProject extends FlowProjectSummary {
  /** The serialised `FlowDoc` (v2). Callers parse it with `parseFlowDoc`. */
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
  /** A v1 graph or a v2 `FlowDoc`; the store writes v2 either way. */
  graphJson?: string;
  source?: FlowSource;
  origin?: FlowOrigin | null;
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

// ─── Flows — W8 (docs/flows-plan.md §3). Stage 0 defines the shapes; the
// handlers land with Stages 1 (nodes, runs), 2 (replies), 5 (freeze), 6
// (export / import). ───

export interface FlowsNodesListResponse {
  success: boolean;
  nodes?: NodeSpec[];
  error?: string;
}

export interface FlowsRunStartRequest {
  flowId: string;
  mode: FlowRunMode;
  /** Keyed by `FlowParam.id`. */
  params: Record<string, unknown>;
  /** Run-level brand (§0.1 item 9): absent = library default, `null` = none. */
  brandId?: string | null;
}

export interface FlowsRunStartResponse {
  success: boolean;
  runId?: string;
  error?: string;
}

export interface FlowsRunCancelRequest {
  runId: string;
}

export interface FlowsRunCancelResponse {
  success: boolean;
  error?: string;
}

export interface FlowsRunResumeRequest {
  runId: string;
}

export interface FlowsRunResumeResponse {
  success: boolean;
  error?: string;
}

/** Pushed on FLOWS_RUN_EVENT (`webContents.send`). */
export type FlowsRunEventPayload = FlowRunEvent;

/** A pause reply: the agents' interaction reply, scoped by run id. */
export interface FlowsRunReplyRequest {
  runId: string;
  reply: InteractionReply;
}

export interface FlowsRunReplyResponse {
  success: boolean;
  error?: string;
}

export interface FlowsRunGetRequest {
  runId: string;
}

export interface FlowsRunGetResponse {
  success: boolean;
  run?: FlowRunDoc;
  error?: string;
}

/** Freeze an agent session's winning path into a draft doc (§1.5). */
export interface FlowsFreezeRequest {
  sessionId: string;
  artifactId: string;
}

export interface FlowsFreezeResponse {
  success: boolean;
  doc?: FlowDoc;
  error?: string;
}

export interface FlowsExportRequest {
  flowId: string;
  /** Absent: the handler asks with a save dialog. */
  targetPath?: string;
}

export interface FlowsExportResponse {
  success: boolean;
  path?: string;
  error?: string;
}

/** A `.vidtsxflow` or a bare `flow.json`, by path or as text (§0.1 item 4). */
export interface FlowsImportRequest {
  path?: string;
  json?: string;
}

export interface FlowsImportResponse {
  success: boolean;
  project?: FlowProject;
  warnings?: string[];
  error?: string;
}
