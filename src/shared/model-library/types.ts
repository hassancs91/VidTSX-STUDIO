/**
 * Category-agnostic model-library core types.
 *
 * These types are shared across processes (main + renderer) and MUST stay free
 * of any `electron` or Node.js runtime import — they are pure type declarations.
 * Category-specific payloads live in the generic `meta: TMeta` slot so the core
 * (scanner, classifier, sidecars, importer, usage store, registries) never
 * assumes image-isms (companions, families) — those are optional per-category
 * capabilities, expressed by each adapter.
 *
 * See docs/local-image-models-redesign.md §3.4 for the design rationale.
 */

/** Every model category the library can host. `3d` is backed by the Python runtime catalogue. */
export type ModelCategory = 'image' | 'stt' | 'tts' | 'llm' | 'embedding' | 'video' | '3d';

/**
 * How a model is laid out on disk.
 * - `single-file`: one checkpoint file (image checkpoints, LLM GGUFs).
 * - `directory`: an extracted folder with several required files (sherpa audio).
 */
export type ModelInstallKind = 'single-file' | 'directory';

/** Where a model file was obtained from, once installed. */
export type ModelOrigin = 'profile' | 'custom';

/** Import strategy when bringing a user-supplied file into the models folder. */
export type ImportMode = 'move' | 'copy';

// ─── Directory install unit (directory categories only) ─────────────────

/** For `directory` install-kind profiles: extracted dir name + files that must exist inside it. */
export interface DirectoryInstallUnit {
  /** Directory name expected directly under the category root. */
  dirName: string;
  /** Files that must all exist inside `dirName` for the profile to count as installed. */
  files: string[];
}

// ─── Scan artifacts ─────────────────────────────────────────────────────

/** A candidate model file discovered by the scanner. */
export interface ScannedFile {
  absolutePath: string;
  fileName: string;
  sizeBytes: number;
  /** Depth relative to the scan root (files directly in root have depth 0). */
  relDepth: number;
}

// ─── Profile envelope ───────────────────────────────────────────────────

/**
 * A curated, compiled-in model profile. Metadata + links, NOT a download
 * instruction. The category payload is nested under `meta`, never flattened.
 */
export interface ModelProfileEnvelope<TMeta> {
  id: string;
  category: ModelCategory;
  name: string;
  /** Approximate; display only. */
  sizeBytes: number;
  sizeLabel: string;
  /** Human page where the user obtains the model (HF repo / Civitai page). */
  sourceUrl: string;
  /**
   * Optional stable, public, unauthenticated direct URL → enables one-click
   * download (D1). Never a learnwithhasan.com URL.
   */
  downloadUrl?: string;
  /** single-file categories: canonical filenames used to auto-match scanned files. */
  matchFileNames?: string[];
  /** directory categories: extracted dir + required files (generalizes audio's isModelDownloaded). */
  directoryUnit?: DirectoryInstallUnit;
  /** Optional hardware hints, display/preflight only. */
  requirements?: { minRamGB?: number; minVramGB?: number };
  /** Category-specific payload (e.g. SdModelMeta, SherpaModelMeta, LlmModelMeta). */
  meta: TMeta;
}

// ─── Sidecar ────────────────────────────────────────────────────────────

/**
 * `<modelfile>.vidtsx.json` — self-describing config for custom (unmatched)
 * models. The category payload is spread at the top level alongside the
 * envelope fields; the adapter validates those extra fields, not the core
 * (hence the index signature).
 */
export interface SidecarFileV1 {
  version: 1;
  category: ModelCategory;
  name?: string;
  [categoryField: string]: unknown;
}

// ─── Runtimes ───────────────────────────────────────────────────────────

/** Shared, independently-installable runtimes that model categories depend on. */
export type RuntimeId = 'sd-cli' | 'sherpa-onnx' | 'llama' | 'pytorch' | 'ffmpeg';

export type RuntimeKind =
  | 'bundled-binary'
  | 'node-module'
  | 'downloadable-binary'
  | 'python-runtime';

export interface RuntimeStatus {
  id: RuntimeId;
  available: boolean;
  /** True when the runtime is missing but the app can install it (e.g. PyTorch). */
  installable: boolean;
  installSizeLabel?: string;
}

export interface RuntimeDescriptor {
  id: RuntimeId;
  kind: RuntimeKind;
  isAvailable(): boolean | Promise<boolean>;
  install?: {
    sizeLabel: string;
    /** Kicks off installation; returns when started (progress is reported elsewhere). */
    start(): void | Promise<void>;
  };
}

// ─── Typed issues (per-model, non-fatal) ────────────────────────────────

export type ModelIssueCode =
  | 'missing-companion'
  | 'missing-runtime'
  | 'unrecognized'
  | 'missing-file'
  | 'unreadable-sidecar';

/** A problem found with an installed model; surfaced in the UI, never thrown. */
export type ModelIssue =
  | {
      code: 'missing-companion';
      kind: string;
      expectedNames: string[];
      searchedDirs: string[];
      sourceUrl?: string;
    }
  | { code: 'missing-runtime'; runtime: RuntimeId }
  | { code: 'unrecognized' }
  | { code: 'missing-file'; filePath: string }
  | { code: 'unreadable-sidecar'; filePath: string; reason?: string };

/** Error codes for operations that legitimately fail (thrown as ModelLibraryError). */
export type ModelLibraryErrorCode =
  | 'file-exists'
  | 'missing-file'
  | 'missing-companion'
  | 'unsupported-category'
  | 'unknown-model'
  | 'import-failed'
  /** Model is too large for both VRAM and RAM — cannot run even with CPU offload. */
  | 'insufficient-memory';

/** Thrown by importer/library operations. Carries a stable code for typed IPC errors. */
export class ModelLibraryError extends Error {
  readonly code: ModelLibraryErrorCode;

  constructor(code: ModelLibraryErrorCode, message: string) {
    super(message);
    this.name = 'ModelLibraryError';
    this.code = code;
  }
}

// ─── Installed model (scan result) ──────────────────────────────────────

export interface InstalledModel<TMeta> {
  /** Profile id when matched, else `custom-<slug>`. */
  id: string;
  category: ModelCategory;
  name: string;
  /** Absolute path to the model file (single-file) or model directory (directory). */
  filePath: string;
  origin: ModelOrigin;
  /** From fs.stat (file) or summed (directory). */
  sizeBytes: number;
  meta: TMeta;
  issues: ModelIssue[];
}

// ─── Usage tracking (local-only) ────────────────────────────────────────

export interface ModelUsageRecord {
  /** ISO timestamp of the most recent use. */
  lastUsedAt: string;
  useCount: number;
}

/** Persisted map keyed `${category}:${modelId}`. */
export type ModelUsageMap = Record<string, ModelUsageRecord>;

// ─── Category descriptor ────────────────────────────────────────────────

/**
 * A per-category adapter registered with the core. `TResolved` is the
 * engine-consumable invocation data produced by `resolve()`.
 */
export interface ModelCategoryDescriptor<TMeta, TResolved = unknown> {
  category: ModelCategory;
  /** Subfolder under the AI-models root (e.g. 'image', 'stt'). */
  dirName: string;
  installKind: ModelInstallKind;
  /** Extensions the scanner should pick up (single-file categories), e.g. ['.safetensors']. */
  fileExtensions: string[];
  profiles: ModelProfileEnvelope<TMeta>[];
  /** Enables custom imports: maps a family key → partial meta preset. */
  familyPresets?: Record<string, Partial<TMeta>>;
  /** image/LLM: true; sherpa audio: false (arbitrary ONNX dirs can't be configured). */
  allowCustomImport: boolean;
  requiredRuntime: RuntimeId;
  /** Turns an installed model into engine-consumable invocation data. */
  resolve(installed: InstalledModel<TMeta>): TResolved;
}
