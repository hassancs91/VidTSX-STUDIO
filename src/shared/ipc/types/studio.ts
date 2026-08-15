import type {
  StudioAssetProbe,
  StudioAssetTranscriptMeta,
  StudioMediaAsset,
  StudioProject,
  StudioProposal,
  StudioShot,
  StudioShotKind,
} from '../../types/studio';
import type { CutPlanStyleName, StudioCutPlan } from '../../types/studio-cut-plan';
import type { CaptionAspect, CaptionTemplateDefaults } from '../../studio/caption-pack';
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
    /** Stored content hash — lets a missing source heal silently from the
     *  asset library before falling back to the manual relink picker. */
    hash?: string;
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
  /** Missing sources found again in the asset library by content hash
   *  (ASSET_LIBRARY_DESIGN.md L7) — the renderer merges the new path into
   *  the document; derived caches are keyed by asset id and survive. */
  healed?: Array<{ assetId: string; path: string }>;
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
  /** Caption the agent reads to pick the right asset (D12/L2). */
  description?: string;
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

// ---------------------------------------------------------------------------
// TSX shots (S4) — preview module resolution. Path authority stays in main:
// the renderer sends ids and a version number, never a file path.
// ---------------------------------------------------------------------------

export interface StudioShotModuleRequest {
  projectId: string;
  shotId: string;
  /** The shot's activeVersion — document state the renderer owns. */
  version: number;
}

export interface StudioShotModuleResponse {
  success: boolean;
  /** Module-server URL of the transpiled ESM, ready to dynamic-import. */
  moduleUrl?: string;
  /** The shot's own compositionConfig, parsed from the source. */
  config?: { durationInFrames: number; fps: number; width: number; height: number };
  error?: string;
}

// ---------------------------------------------------------------------------
// TSX shot generation (S4 D8) — request/response is a fast-fail handshake;
// completion streams over STUDIO_SHOT_JOB_EVENT (the media-job pattern). Main
// writes ONLY shots/<id>/v*.tsx — the renderer owns the registry via the
// non-committing `shots-adopt`, so the two never race over project.json.
// ---------------------------------------------------------------------------

/** 'import' (D14) rides the same job stream as the pipeline ops: a clean
 *  import emits one 'ready', a conform run emits progress like a generation. */
export type StudioShotGenerateOp = 'generate' | 'edit' | 'regenerate' | 'import';

export interface StudioShotGenerateRequest {
  projectId: string;
  op: StudioShotGenerateOp;
  /** generate/regenerate: what the shot should show. */
  kind?: StudioShotKind;
  brief?: string;
  /** Display name; derived from the brief when absent. */
  name?: string;
  /** Word-sync anchor (D7) — source-media seconds on a transcribed asset. */
  anchor?: { assetId: string; sourceStart: number; sourceEnd: number };
  /** Media inside the shot (D12): key → project asset id or 'library:<relPath>'
   *  (library values import on use; the registry stores project ids). */
  assetRefs?: Record<string, string>;
  durationSeconds?: number;
  /** edit/regenerate: the existing shot (folder) to write the next version of. */
  shotId?: string;
  /** edit: version the instruction applies to (the shot's activeVersion). */
  activeVersion?: number;
  /** edit: the change instruction (inspector edit box). */
  instruction?: string;
  providerId?: string;
}

export interface StudioShotGenerateResponse {
  success: boolean;
  /** Reserved shot id (generate) or the target id (edit/regenerate). */
  shotId?: string;
  error?: string;
}

/** Push events for shot pipeline runs (agent tool calls emit these too). */
export interface StudioShotJobEvent {
  projectId: string;
  shotId: string;
  op: StudioShotGenerateOp;
  status: 'generating' | 'ready' | 'error';
  /** 0..100 pipeline progress while 'generating'. */
  percent?: number;
  message?: string;
  /** Registry-shaped snapshot — present on every status so the renderer can
   *  adopt the provisional, final, or error entry via `shots-adopt`. */
  shot?: StudioShot;
  /** Library assets imported on use for this shot (D12) — rides the first
   *  'generating' event; the renderer merges them into project.assets (the
   *  document owner), keyed by id so re-delivery is harmless. */
  importedAssets?: StudioMediaAsset[];
  error?: string;
}

export interface StudioShotVersionsRequest {
  projectId: string;
  shotId: string;
}

export interface StudioShotVersionsResponse {
  success: boolean;
  /** Versions on disk, ascending (folder-as-truth — scanned, not stored). */
  versions?: number[];
  error?: string;
}

/** One importable TSX Creator project (D14) — a folder of v*.tsx. */
export interface StudioCreatorProject {
  /** Folder name, also the display name. */
  id: string;
  name: string;
  /** mtime of the latest version file, ISO. */
  updatedAt: string;
  latestVersion: number;
  /** Absolute path of that latest version — what the import service takes. */
  filePath: string;
}

export interface StudioCreatorProjectsResponse {
  success: boolean;
  projects?: StudioCreatorProject[];
  error?: string;
}

/** Import a TSX as a shot (D14). SOURCE-AGNOSTIC on purpose: a source file
 *  plus a display name is the whole contract, so the Creator picker, the OS
 *  file picker and (later) a tsx-template pack are interchangeable callers. */
export interface StudioShotImportRequest {
  projectId: string;
  /** Absolute path of the .tsx. Omitted → main opens the OS file picker. */
  sourcePath?: string;
  /** Display name; derived from the path when absent. */
  name?: string;
  /** "Convert for Studio": one conform pass before the gate (allowlist gap). */
  conform?: boolean;
  providerId?: string;
}

export interface StudioShotImportResponse {
  success: boolean;
  /** Present once the shot folder exists; the ready entry arrives as a job event. */
  shotId?: string;
  /** The file picker was dismissed — not an error. */
  canceled?: boolean;
  error?: string;
  /** The failure is only the allowlist gap — the caller may offer Convert. */
  conformable?: boolean;
  /** Echoed back so the Convert action can re-import the same source. */
  sourcePath?: string;
  name?: string;
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

// ─── Caption templates (D13, PACKS_DESIGN.md) ───────────────────────────────

/** A caption template as the panel lists it — namespaced id + display data.
 *  The absolute file path stays in main; the renderer only ever asks for a
 *  module URL by id. */
export interface StudioCaptionTemplateInfo {
  /** `<packId>/<itemId>`, e.g. 'core/word-pop' — what the document stores. */
  templateId: string;
  name: string;
  packId: string;
  packName: string;
  description?: string;
  /** Words the gallery card animates in its mini-Player. */
  sampleWords?: string[];
  /** Per-aspect style seeds applied when the user first picks this template. */
  defaults?: Partial<Record<CaptionAspect, CaptionTemplateDefaults>>;
}

export interface StudioCaptionTemplatesResponse {
  success: boolean;
  templates?: StudioCaptionTemplateInfo[];
  error?: string;
}

export interface StudioCaptionTemplateModuleRequest {
  templateId: string;
}

export interface StudioCaptionTemplateModuleResponse {
  success: boolean;
  /** Module-server URL the renderer dynamic-imports into the Player. */
  moduleUrl?: string;
  error?: string;
}
