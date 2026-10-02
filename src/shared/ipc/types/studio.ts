import type { StudioAnalysisMeta } from './studio-analysis';
import type { StudioPresetUpdateProposal } from '../../types/studio-preset';
import type {
  StudioAssetProbe,
  StudioAssetTranscriptMeta,
  StudioMediaAsset,
  StudioCaptionStyle,
  StudioProject,
  StudioProposal,
  StudioProposalKind,
  StudioShot,
  StudioShotKind,
} from '../../types/studio';
import type { CutPlanStyleName, StudioCutPlan } from '../../types/studio-cut-plan';
import type {
  StudioMemoryProposal,
  StudioStylePromotionProposal,
  StudioVocabularyProposal,
} from '../../types/studio-memory';
import type { CaptionAspect, CaptionTemplateDefaults } from '../../studio/caption-pack';
import type { ExportEngineId } from '../../studio/export-engines';
import type { ChatMessage } from './llm';
import type { ThinkingLevel } from '../../tsx-engine/types';

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
  /** W6: `cache/poster.jpg` relative to the project cache (read through
   *  STUDIO_CACHE_READ like asset thumbnails); absent when the project has no
   *  video clip — the card draws the brand-palette placeholder instead. */
  posterPath?: string;
  /** W6: the project's library brand, so a placeholder can use its palette. */
  brandId?: string;
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
  /** W5: the editing preset the new project starts on (validated in main;
   *  a preset's defaultBrandId wins over the library default brand). */
  presetId?: string;
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

/** W6: the editor closed this project — main writes its poster now rather
 *  than waiting out the save debounce (there may be no dirty save at all). */
export interface StudioProjectCloseRequest {
  id: string;
}

export interface StudioProjectCloseResponse {
  success: boolean;
  error?: string;
}

export interface StudioProjectDeleteRequest {
  id: string;
}

export interface StudioProjectDeleteResponse {
  success: boolean;
  error?: string;
}

// ── Rotating project snapshots + quit-flush handshake (Q10) ──

export interface StudioProjectSnapshotInfo {
  /** File name inside <project>/snapshots/ — also the restore handle. */
  file: string;
  /** ISO timestamp the snapshot was taken. */
  savedAt: string;
  sizeBytes: number;
}

export interface StudioSnapshotListRequest {
  id: string;
}

export interface StudioSnapshotListResponse {
  success: boolean;
  /** Newest first. */
  snapshots?: StudioProjectSnapshotInfo[];
  error?: string;
}

export interface StudioSnapshotRestoreRequest {
  id: string;
  file: string;
}

export interface StudioSnapshotRestoreResponse {
  success: boolean;
  /** The restored document, already written to project.json. */
  project?: StudioProject;
  /** Safety snapshot of the pre-restore state — restore it to undo. */
  undoFile?: string;
  error?: string;
}

// ── Project brand snapshot (video-10 feedback item 7) ──

/** studio:project:brand:get — the project's own `brand.json`, if it has one. */
export interface StudioProjectBrandGetRequest {
  projectId: string;
}

export interface StudioProjectBrandGetResponse {
  success: boolean;
  /** null = the project carries no (readable) snapshot. */
  brand?: import('../../types/asset-library').StudioBrand | null;
  error?: string;
}

/** studio:project:brand:promote — copy the snapshot into the library
 *  (`assets/brands/<slug>/`). The caller sets `settings.brandId` to the result. */
export interface StudioProjectBrandPromoteRequest {
  projectId: string;
}

export interface StudioProjectBrandPromoteResponse {
  success: boolean;
  brand?: import('../../types/asset-library').StudioBrand;
  error?: string;
}

export interface StudioFlushAckResponse {
  success: boolean;
}

export interface StudioMediaImportRequest {
  projectId: string;
  /** Explicit files to import (a drop, or automation). Absent: the native picker opens. */
  filePaths?: string[];
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
 * automatically on open; transcripts ONLY by an explicit user action;
 * analysis tracks (`faceTrack`, `subjectMask`) when a tracked filter is
 * applied (docs/studio/FILTER_PACKS_DESIGN.md "Analysis tracks").
 */
export type StudioMediaJobKind = 'proxy' | 'waveform' | 'transcript' | 'faceTrack' | 'subjectMask';

export interface StudioMediaJobEvent {
  projectId: string;
  assetId: string;
  kind: StudioMediaJobKind;
  /** 'canceled' is only emitted for explicit per-job cancels (transcripts, analysis). */
  status: 'generating' | 'ready' | 'error' | 'canceled';
  /** Cache-relative path, present when status is 'ready'. */
  relPath?: string;
  /** 0..100 — long jobs (transcription) stream progress while 'generating'. */
  percent?: number;
  /** Human-readable progress detail ("Uploading audio…"). */
  message?: string;
  /** Transcript jobs: document-ready metadata, present when 'ready'. */
  transcript?: StudioAssetTranscriptMeta;
  /** Analysis jobs: what the track on disk covers and which provider ran, present when 'ready'. */
  analysis?: StudioAnalysisMeta;
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
  /** Registry snapshot (renderer owns the document): the agent's view of the
   *  shot pool. `list_shots` reads it; `propose_shots` may place any READY
   *  member — this is what un-strands shots from earlier sessions. */
  shots: StudioShot[];
  /** A cut proposal is open in the review panel — propose_cuts must refuse. */
  reviewOpen: boolean;
  /** The open review-panel proposal, when there is one (W3): what
   *  `accept_proposal` may apply on the user's say-so. */
  openProposal?: StudioAgentOpenProposal;
  /** The project's transcription model (Inspector picker) — the default for
   *  `transcribe_asset`. Absent = the app default. */
  sttModelId?: string;
  /** The caption layer as it stands (W3 `set_captions` reads it back). */
  captions?: { templateId: string; enabled: boolean };
  /** Length of the current edit, timeline seconds (0 = empty). */
  timelineDurationSeconds?: number;
  /** W4: the project script as the renderer holds it (the live copy — the
   *  save debounce may lag). The opening rides the system prompt;
   *  `get_script` reads the rest. */
  script?: string;
  providerId?: string;
  /** Planning model for this turn. */
  model?: string;
  /** Model `generate_tsx_shot` runs on; falls back to `model`. */
  shotModel?: string;
  /** Thinking dial for the planning turn (THINKING_CONFIGS key). */
  thinking?: ThinkingLevel;
}

export interface StudioAgentOpenProposal {
  id: string;
  kind: StudioProposalKind;
  itemCount: number;
  /** First line of the proposal's agentNote — the review header. */
  note?: string;
}

/**
 * W3: what main asks the RENDERER to do on the user's behalf. The document
 * (timeline, proposals, captions) and the render queue are renderer-owned,
 * so these ride the agent event stream as requests and come back through
 * STUDIO_AGENT_ACTION_RESULT. Every action is either something the user
 * explicitly asked for in chat (apply, export) or a reversible setting
 * (captions) — never a silent bulk edit.
 */
export type StudioAgentAction =
  | { type: 'apply-proposal'; proposalId: string }
  | {
      type: 'export';
      /** Main mints the id so the tool can name the queue row it created. */
      jobId: string;
      engineId?: ExportEngineId;
    }
  | {
      type: 'set-captions';
      templateId: string;
      enabled: boolean;
      /** First-apply style seed for the project's aspect (the panel's rule). */
      seed?: CaptionTemplateDefaults;
      style?: Partial<StudioCaptionStyle>;
    };

export interface StudioAgentActionResultRequest {
  projectId: string;
  requestId: string;
  success: boolean;
  /** What happened, in the renderer's words — relayed to the model. */
  message?: string;
  error?: string;
}

export interface StudioAgentActionResultResponse {
  success: boolean;
}

export interface StudioAgentSendResponse {
  success: boolean;
  text?: string;
  /** Whether typed editing tools were available on the resolved provider. */
  toolsAvailable?: boolean;
  error?: string;
}

// Persisted Assistant transcript (SHOT_QUALITY_DESIGN.md Q1d): display rows
// as the renderer keeps them, written beside project.json after each turn.
export interface StudioAgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** When the message was created (ISO). Absent on transcripts older than 2026-09-12. */
  at?: string;
  /** The provider/model that answered (assistant rows) — for the exported chat. */
  providerId?: string;
  model?: string;
  /** Tool activity chips shown above the reply. `args`/`result` are the raw
   *  exchange (capped in main, see tool-result-events.ts) — the exported chat
   *  can include them; the panel shows only tool + detail. */
  toolCalls?: Array<{ tool: string; detail?: string; args?: string; result?: string; isError?: boolean }>;
  /** Set when the turn produced a proposal. */
  proposalNote?: string;
  error?: boolean;
}

export interface StudioAgentChatLoadRequest {
  projectId: string;
}

export interface StudioAgentChatLoadResponse {
  success: boolean;
  messages?: StudioAgentChatMessage[];
  error?: string;
}

export interface StudioAgentChatSaveRequest {
  projectId: string;
  messages: StudioAgentChatMessage[];
}

export interface StudioAgentChatSaveResponse {
  success: boolean;
  error?: string;
}

export interface StudioAgentChatResetRequest {
  projectId: string;
}

export interface StudioAgentChatResetResponse {
  success: boolean;
  error?: string;
}

/** Push events streamed while an agent turn runs. */
export type StudioAgentEvent =
  | { projectId: string; kind: 'delta'; text: string }
  | { projectId: string; kind: 'tool'; tool: string; detail?: string }
  | { projectId: string; kind: 'proposal'; proposal: StudioProposal }
  | { projectId: string; kind: 'memory-proposal'; proposal: StudioMemoryProposal }
  | { projectId: string; kind: 'style-promotion-proposal'; proposal: StudioStylePromotionProposal }
  /** W4: a "add these to the brand vocabulary" card (multi-select accept). */
  | { projectId: string; kind: 'vocabulary-proposal'; proposal: StudioVocabularyProposal }
  /** W5: a "learn from this video" card — knob diff + a learned section. */
  | { projectId: string; kind: 'preset-update-proposal'; proposal: StudioPresetUpdateProposal }
  /** W3: a long tool (transcribe, video) streaming progress — updates the
   *  latest tool chip in place instead of adding one. */
  | { projectId: string; kind: 'progress'; tool: string; percent?: number; message: string }
  /** A tool finished: its arguments and result text (capped) — recorded on
   *  the latest chip of that tool so "Save chat with tool details" has them. */
  | { projectId: string; kind: 'tool-result'; tool: string; args: string; result: string; isError?: boolean }
  /** W3: a request for the renderer (see StudioAgentAction); answered over
   *  STUDIO_AGENT_ACTION_RESULT with the same requestId. */
  | { projectId: string; kind: 'action'; requestId: string; action: StudioAgentAction }
  /** W3: library assets imported on use by a tool (generate_video,
   *  insert_asset) — the document owner merges them, id-keyed. */
  | { projectId: string; kind: 'assets-imported'; assets: StudioMediaAsset[] };

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
 *  import emits one 'ready', a conform run emits progress like a generation.
 *  'refine' (Q5) is the stills-critique round: render stills of the active
 *  version, one vision critique-and-revise edit pass, next version. */
export type StudioShotGenerateOp = 'generate' | 'edit' | 'regenerate' | 'import' | 'refine';

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
  /** edit/regenerate/refine: the existing shot (folder) to write the next version of. */
  shotId?: string;
  /** edit/refine: version the op applies to (the shot's activeVersion). */
  activeVersion?: number;
  /** edit: the change instruction (inspector edit box). */
  instruction?: string;
  providerId?: string;
  /** The project's shot model (settings.agent.shotModel ?? model). */
  model?: string;
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
/** "Convert for Studio" for a shot already in the project (Q7d import card).
 *  Lands as a NEW VERSION in the SAME shot folder — the id every clip
 *  references must survive the conversion. */
export interface StudioShotConformRequest {
  projectId: string;
  shotId: string;
  providerId?: string;
}

export interface StudioShotConformResponse {
  success: boolean;
  shotId?: string;
  /** The version the shot now points at. */
  version?: number;
  error?: string;
}

export interface StudioShotImportRequest {
  projectId: string;
  /** Absolute path of the .tsx. Omitted → main opens the OS file picker. */
  sourcePath?: string;
  /** Display name; derived from the path when absent. */
  name?: string;
  /** "Convert for Studio": one conform pass before the gate (allowlist gap). */
  conform?: boolean;
  providerId?: string;
  /** The project's shot model, for the conform pass. */
  model?: string;
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

// Shots/ ↔ registry reconcile (SHOT_QUALITY_DESIGN.md Q1c): the renderer sends
// the ids it already has; adopted entries travel as shot job events (the
// adoption path), the response only summarizes for the toast/banner.
export interface StudioShotsReconcileRequest {
  projectId: string;
  knownShotIds: string[];
}

export interface StudioShotsReconcileFailure {
  shotId: string;
  /** Newest version file — Convert re-enters the import path with this. */
  sourcePath: string;
  error: string;
  /** Only the allowlist gap failed — the caller may offer Convert. */
  conformable: boolean;
}

export interface StudioShotsReconcileResponse {
  success: boolean;
  adopted?: StudioShot[];
  failures?: StudioShotsReconcileFailure[];
  error?: string;
}

// Linked folder (SHOT_QUALITY_DESIGN.md Q2): the Creator library's live view
// of Studio shot folders — folders of v*.tsx, listed in place, never copied.
export interface StudioShotLibraryShotIpc {
  shotId: string;
  name: string;
  folderPath: string;
  /** Absolute version paths, ascending (v1 first). */
  versions: string[];
}

export interface StudioShotLibraryProjectIpc {
  projectId: string;
  projectName: string;
  shots: StudioShotLibraryShotIpc[];
}

export interface StudioShotLibraryResponse {
  success: boolean;
  projects?: StudioShotLibraryProjectIpc[];
  error?: string;
}

export interface StudioExportPrepareRequest {
  project: StudioProject;
  /** Optional export range in timeline seconds (Slice D2). When both are set,
   *  main trims the timeline to [rangeIn, rangeOut) — snapped to the frame
   *  grid — and renders exactly that many frames. */
  rangeIn?: number;
  rangeOut?: number;
  /** Which video file each asset is read from (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md
   *  Phase 2): the original, or the 540p preview proxy for a draft. Absent = original. */
  source?: import('../../studio/export-source').ExportSource;
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

/** One registered export engine as the Export dialog / Settings see it:
 *  availability is a main-process fact (a missing optional binary), the
 *  wording comes from the shared catalogue. */
export interface StudioExportEngineStatus {
  id: ExportEngineId;
  available: boolean;
  /** Why it is greyed out, when it is. */
  unavailableReason?: string;
}

export interface StudioExportEnginesListResponse {
  engines: StudioExportEngineStatus[];
  /** Settings › Rendering default (D2). */
  defaultId: ExportEngineId;
  /** Dev builds only: the hidden verification mode (D5) may be offered. */
  verifyAvailable: boolean;
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
