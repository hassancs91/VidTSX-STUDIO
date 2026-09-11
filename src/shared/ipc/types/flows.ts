import type {
  FlowDoc,
  FlowOrigin,
  FlowRunDoc,
  FlowRunEvent,
  FlowRunMode,
  FlowSource,
  FlowPackageInfo,
  FlowHandoffParam,
  NodeSpec,
  FlowProposal,
} from '../../types/flows';
import type { AgentArtifact, InteractionReply } from '../../types/agents';
import type {
  AgentArtifactActionKind,
  AgentArtifactActionResponse,
  AgentArtifactResolveResponse,
} from './agents';

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
  /** W8 Stage 6: the package behind a `builtin` / `installed` row. */
  package?: FlowPackageInfo;
  /** W8 Stage 6: the `image` / `video` params other screens can prefill. */
  handoffParams?: FlowHandoffParam[];
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
  /** Stage 1: the run folder's artifacts, so the canvas can preview ports. */
  artifacts?: AgentArtifact[];
  /** Artifact id → one servable url per file (image-set, video, audio). */
  assetUrls?: Record<string, string[]>;
  /** Not running now and at least one node is not done — Resume is offered. */
  resumable?: boolean;
  error?: string;
}

/** Freeze an agent session's winning path into a draft doc (§1.5, Stage 5). */
export interface FlowsFreezeRequest {
  /** Sessions are per agent (agents plan §1.5); both name the folder. */
  agentId: string;
  sessionId: string;
  artifactId: string;
  /**
   * True: the session's agent gets one turn with the draft and `save_flow`
   * to name it, describe it and pick the params; the proposal then arrives
   * on the run stream. False / absent: the draft is queued as a proposal at
   * once ("Frozen from session …", Accept / Discard on the canvas).
   */
  viaAgent?: boolean;
}

export interface FlowsFreezeResponse {
  success: boolean;
  doc?: FlowDoc;
  /** The queued proposal (the direct path). */
  proposalId?: string;
  /** The agent is naming it; the card follows as a `flow-proposal` event. */
  viaAgent?: boolean;
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
  /** The user answered yes to the downgrade prompt. */
  confirmDowngrade?: boolean;
}

export interface FlowsImportResponse {
  success: boolean;
  project?: FlowProject;
  /** The unsigned / unverified-publisher notice, and anything else worth a toast. */
  warnings?: string[];
  /** The install stopped and wants an explicit yes (an older version than the installed one). */
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  /** True when the user closed the file dialog. */
  canceled?: boolean;
  error?: string;
}

/** Stage 6: the `.vidtsxflow` the OS handed the app, claimed once by the Flows screen. */
export interface FlowsPendingPackageResponse {
  filePath?: string;
}

/** Pushed main → renderer when a `.vidtsxflow` is double-clicked: navigation only;
 *  the path rides along when it is known and is absent on a cold start, where
 *  the Flows screen claims it on mount anyway. */
export interface FlowsPackageOpenFileEvent {
  filePath?: string;
}

// ─── Flows — W8 Stage 2: a run's artifacts through the shared viewers and
// the shared action bar. Same response shapes as the agents' resolve/action;
// the request is run-scoped because a run's `artifacts.json` is not a
// session's. ───

export interface FlowsRunArtifactResolveRequest {
  runId: string;
  artifactId: string;
}

export type FlowsRunArtifactResolveResponse = AgentArtifactResolveResponse;

export interface FlowsRunArtifactActionRequest {
  runId: string;
  artifactId: string;
  action: AgentArtifactActionKind;
  /** `open-in-studio` only: the open Studio project. */
  projectId?: string;
}

export type FlowsRunArtifactActionResponse = AgentArtifactActionResponse;

// ─── Flows — W8 Stage 4: the Flow Builder's proposal card (flows plan §1.6).
// `propose_flow` never writes; Accept saves through FLOWS_PROJECT_UPDATE /
// FLOWS_PROJECT_CREATE in the renderer, then resolves the card here. ───

export interface FlowsProposalGetRequest {
  /** The builder session whose card to read. */
  sessionId: string;
}

export interface FlowsProposalGetResponse {
  success: boolean;
  proposal?: FlowProposal | null;
  error?: string;
}

export interface FlowsProposalResolveRequest {
  sessionId: string;
  proposalId: string;
  accepted: boolean;
}

export interface FlowsProposalResolveResponse {
  success: boolean;
  error?: string;
}
