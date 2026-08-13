import type {
  StudioAssetProbe,
  StudioAssetTranscriptMeta,
  StudioMediaAsset,
  StudioProject,
  StudioProposal,
} from '../../types/studio';
import type { CutPlanStyleName, StudioCutPlan } from '../../types/studio-cut-plan';
import type { ChatMessage } from './llm';

// Studio (AI video editor) — projects & media IPC contracts.

export interface StudioProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  folderPath: string;
}

export interface StudioRootGetResponse {
  root: string;
}

export interface StudioRootSetRequest {
  root: string;
}

export interface StudioRootSetResponse {
  success: boolean;
  error?: string;
}

export interface StudioProjectListResponse {
  success: boolean;
  projects?: StudioProjectSummary[];
  root?: string;
  error?: string;
}

export interface StudioProjectCreateRequest {
  name: string;
  width: number;
  height: number;
  fps: number;
}

export interface StudioProjectCreateResponse {
  success: boolean;
  project?: StudioProject;
  error?: string;
}

export interface StudioProjectLoadRequest {
  id: string;
}

export interface StudioProjectLoadResponse {
  success: boolean;
  project?: StudioProject;
  /** Absolute project folder — the renderer builds cache/proxy URLs from it. */
  folderPath?: string;
  error?: string;
}

export interface StudioProjectSaveRequest {
  project: StudioProject;
}

export interface StudioProjectSaveResponse {
  success: boolean;
  updatedAt?: string;
  error?: string;
}

export interface StudioProjectDeleteRequest {
  id: string;
}

export interface StudioProjectDeleteResponse {
  success: boolean;
  error?: string;
}

export interface StudioMediaImportRequest {
  projectId: string;
}

export interface StudioMediaImportResponse {
  success: boolean;
  canceled?: boolean;
  /** Newly imported assets — the renderer merges them into the document. */
  assets?: StudioMediaAsset[];
  /** Per-file failures (unsupported type, probe error). */
  errors?: string[];
  error?: string;
}

export interface StudioCacheReadRequest {
  projectId: string;
  /** Path relative to the project's cache/ folder (e.g. "thumbs/<id>.jpg"). */
  relPath: string;
}

export interface StudioCacheReadResponse {
  success: boolean;
  /** Base64-encoded file contents. */
  data?: string;
  mime?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Cache visibility — size readout, open in Explorer, clear (all re-derivable:
// proxies/waveforms regenerate on the next open, transcripts on explicit re-run)
// ---------------------------------------------------------------------------

export interface StudioCacheInfoRequest {
  projectId: string;
}

export interface StudioCacheInfoResponse {
  success: boolean;
  sizeBytes?: number;
  fileCount?: number;
  error?: string;
}

export interface StudioCacheOpenRequest {
  projectId: string;
}

export interface StudioCacheOpenResponse {
  success: boolean;
  error?: string;
}

export interface StudioCacheClearRequest {
  projectId: string;
}

export interface StudioCacheClearResponse {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Timeline preview, background media jobs, export
// ---------------------------------------------------------------------------

/**
 * Derived caches an asset can have. Proxies/waveforms are requested
 * automatically on open; transcripts ONLY by an explicit user action.
 */
export type StudioMediaJobKind = 'proxy' | 'waveform' | 'transcript';

export interface StudioMediaJobEvent {
  projectId: string;
  assetId: string;
  kind: StudioMediaJobKind;
  /** 'canceled' is only emitted for explicit per-job cancels (transcripts). */
  status: 'generating' | 'ready' | 'error' | 'canceled';
  /** Cache-relative path, present when status is 'ready'. */
  relPath?: string;
  /** 0..100 — long jobs (transcription) stream progress while 'generating'. */
  percent?: number;
  /** Human-readable progress detail ("Uploading audio…"). */
  message?: string;
  /** Transcript jobs: document-ready metadata, present when 'ready'. */
  transcript?: StudioAssetTranscriptMeta;
  error?: string;
}

export interface StudioMediaPrepareRequest {
  projectId: string;
  assets: Array<{
    id: string;
    kind: 'video' | 'audio' | 'image';
    path: string;
    /** Silent sources get no waveform job — ffmpeg would just fail on them. */
    hasAudio: boolean;
  }>;
}

export interface StudioMediaPrepareResponse {
  success: boolean;
  /** Caches that already existed on disk — applied without waiting for events. */
  ready?: StudioMediaJobEvent[];
  /** Base URL of the local asset server the preview loads media through. */
  assetBaseUrl?: string;
  /** Asset ids whose source file is gone from disk (Slice F relink). Their
   *  proxy/waveform jobs are skipped — ffmpeg would only fail on them. */
  missing?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Media relink (Slice F) — reconnect a moved/renamed source file
// ---------------------------------------------------------------------------

export interface StudioMediaRelinkRequest {
  projectId: string;
  assetId: string;
  /** Stored content hash to verify the pick against (absent = no check). */
  expectedHash?: string;
  /** Use this file instead of opening the native dialog — the renderer passes
   *  the already-picked path back when the user confirms a hash mismatch. */
  filePath?: string;
  /** User confirmed relinking despite a hash mismatch. */
  allowMismatch?: boolean;
}

export interface StudioMediaRelinkResponse {
  success: boolean;
  canceled?: boolean;
  /** The picked file's content hash differs from the stored one — the
   *  renderer confirms with the user, then retries with allowMismatch. */
  mismatch?: boolean;
  /** Absolute path of the mismatching pick (echoed back on retry). */
  pickedPath?: string;
  /** On success: the fields the renderer merges into the asset. Caches stay
   *  keyed by asset id, so proxies/waveforms/transcripts survive untouched. */
  asset?: { path: string; probe: StudioAssetProbe; hash?: string };
  error?: string;
}

// ---------------------------------------------------------------------------
// Per-asset transcription (button-triggered) + auto-cut planning
// ---------------------------------------------------------------------------

export interface StudioTranscribeStartRequest {
  projectId: string;
  assetId: string;
  /** Absolute path of the source media (video or audio). */
  sourcePath: string;
  /** STT catalog id (e.g. 'local-whisper/base', 'assemblyai/universal'). */
  sttModelId: string;
}

export interface StudioTranscribeStartResponse {
  success: boolean;
  /** Fast-fail reasons (unknown model, provider not configured). */
  error?: string;
}

export interface StudioTranscribeCancelRequest {
  projectId: string;
  assetId: string;
}

export interface StudioTranscribeCancelResponse {
  success: boolean;
}

export interface StudioCutPlanRunRequest {
  projectId: string;
  assetId: string;
  /** Absolute source path — needed if the RMS envelope must be regenerated. */
  sourcePath: string;
  style?: CutPlanStyleName;
}

export interface StudioCutPlanRunResponse {
  success: boolean;
  plan?: StudioCutPlan;
  /** Absolute path of the written plan JSON, for external inspection. */
  planPath?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Editing agent (Assistant tab chat)
// ---------------------------------------------------------------------------

/** What the agent may know about an asset (goes into its system prompt). */
export interface StudioAgentAssetInfo {
  id: string;
  name: string;
  kind: 'video' | 'audio' | 'image';
  /** Absolute source path — needed if the RMS envelope must be regenerated. */
  path: string;
  durationSeconds?: number;
  transcript?: {
    engine: string;
    wordCount?: number;
    /** Verbatim disfluencies preserved — the editorial pass depends on this. */
    verbatim?: boolean;
  };
}

export interface StudioAgentSendRequest {
  projectId: string;
  /** Display name for the system prompt (main never re-loads the document). */
  projectName: string;
  /** The new user message (also the last entry the model sees). */
  prompt: string;
  /** Prior chat turns, oldest first, excluding `prompt`. */
  history: ChatMessage[];
  assets: StudioAgentAssetInfo[];
  /** A cut proposal is open in the review panel — propose_cuts must refuse. */
  reviewOpen: boolean;
  providerId?: string;
  model?: string;
}

export interface StudioAgentSendResponse {
  success: boolean;
  text?: string;
  /** Whether typed editing tools were available on the resolved provider. */
  toolsAvailable?: boolean;
  error?: string;
}

/** Push events streamed while an agent turn runs. */
export type StudioAgentEvent =
  | { projectId: string; kind: 'delta'; text: string }
  | { projectId: string; kind: 'tool'; tool: string; detail?: string }
  | { projectId: string; kind: 'proposal'; proposal: StudioProposal };

export interface StudioAgentCancelRequest {
  projectId: string;
}

export interface StudioAgentCancelResponse {
  success: boolean;
}

export interface StudioExportPrepareRequest {
  project: StudioProject;
  /** Optional export range in timeline seconds (Slice D2). When both are set,
   *  main trims the timeline to [rangeIn, rangeOut) — snapped to the frame
   *  grid — and renders exactly that many frames. */
  rangeIn?: number;
  rangeOut?: number;
}

export interface StudioExportPrepareResponse {
  success: boolean;
  /** Generated Remotion entry to hand to the render queue. */
  entryPath?: string;
  compositionId?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
  error?: string;
}
