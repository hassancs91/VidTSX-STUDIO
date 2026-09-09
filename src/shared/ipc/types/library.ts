import type {
  LibraryDescribeAvailability,
  LibraryIndexEntry,
  LibraryPrefs,
  LibrarySizes,
  StudioBrand,
} from '../../types/asset-library';
import type { StudioBrandInput } from '../../studio/brand';
import type { StudioPresetInput } from '../../studio/preset';
import type { StudioPresetEntry } from '../../types/studio-preset';

// ─── Asset library — index overlay, sizes, root override ───

/** library:index:get — scans the assets root, reconciles the index, returns it. */
export interface LibraryIndexGetResponse {
  success: boolean;
  /** Effective assets root (override honored), absolute path. */
  root?: string;
  entries?: LibraryIndexEntry[];
  error?: string;
}

/** library:description:set — set (or clear with '') one asset's description. */
export interface LibraryDescriptionSetRequest {
  relPath: string;
  description: string;
}

export interface LibraryDescriptionSetResponse {
  success: boolean;
  error?: string;
}

/** library:sizes:get — per-folder recursive sizes + total for the assets root. */
export interface LibrarySizesGetResponse {
  success: boolean;
  sizes?: LibrarySizes;
  error?: string;
}

/** library:root:get — effective assets root + whether it's an override. */
export interface LibraryRootGetResponse {
  success: boolean;
  root?: string;
  defaultRoot?: string;
  isOverride?: boolean;
  error?: string;
}

/** library:root:set — set or clear (null) the assets-root override. */
export interface LibraryRootSetRequest {
  root: string | null;
}

export interface LibraryRootSetResponse {
  success: boolean;
  root?: string;
  error?: string;
}

// ─── AI descriptions — availability, consent, batch job (L2) ───

/** library:describe:availability — can describe run right now, and if not, why. */
export interface LibraryDescribeAvailabilityResponse {
  success: boolean;
  availability?: LibraryDescribeAvailability;
  /** Consent + note-dismissal + the auto-describe-on-import default. */
  prefs?: LibraryPrefs;
  error?: string;
}

/** library:prefs:set — partial update of the library preferences. */
export interface LibraryPrefsSetRequest {
  /** Grant the one-time AI-describe consent (never revoked from here). */
  grantDescribeConsent?: boolean;
  noProviderNoteDismissed?: boolean;
  autoDescribeOnImport?: boolean;
}

export interface LibraryPrefsSetResponse {
  success: boolean;
  prefs?: LibraryPrefs;
  error?: string;
}

/**
 * library:describe:start — batch "Describe with AI". Returns as soon as the
 * batch is queued; every result arrives on LIBRARY_DESCRIBE_EVENT. Refused
 * when describe is unavailable or consent has not been granted.
 */
export interface LibraryDescribeStartRequest {
  /** Library-relative paths. Non-images are filtered out before the run. */
  relPaths: string[];
}

export interface LibraryDescribeStartResponse {
  success: boolean;
  /** How many assets the batch will actually call the provider for. */
  total?: number;
  error?: string;
}

/** library:describe:cancel — abandon the in-flight batch. */
export interface LibraryDescribeCancelResponse {
  success: boolean;
  error?: string;
}

export type LibraryDescribeJobStatus =
  | 'queued'
  | 'describing'
  | 'ready'
  | 'failed'
  | 'batch-done'
  | 'batch-canceled';

/**
 * library:describe:event — per-item progress (the media-job event pattern).
 * `failed` is one asset's problem, never the batch's: the run continues.
 * The two batch-* statuses carry an empty relPath and the run summary.
 */
export interface LibraryDescribeJobEvent {
  /** Library-relative path; '' on the batch-level statuses. */
  relPath: string;
  status: LibraryDescribeJobStatus;
  /** Present on 'ready' — the description already written to the index. */
  description?: string;
  /** Present on 'failed'. */
  error?: string;
  /** Items finished so far, and the batch size. */
  done: number;
  total: number;
  /** Present on the batch-* statuses. */
  succeeded?: number;
  failed?: number;
}

// ─── AI organize — suggest, review, apply (L7) ───

/**
 * library:organize:suggest — an agent pass over the index returns a move
 * plan. `openProjectId` is the Studio project the RENDERER currently has
 * open; the assets it references come back as `skipped`, not as proposals
 * (L7 Rev 2 — relink-on-open never fires mid-session, so moving a file out
 * from under a live session would break it until the next open).
 */
export interface LibraryOrganizeSuggestRequest {
  openProjectId?: string;
}

/** One proposed move, each with its own accept/reject in the review gate. */
export interface LibraryOrganizeMove {
  relPath: string;
  fromFolder: string;
  toFolder: string;
  toRelPath: string;
  reason: string;
}

/** A move that was excluded before review, with the reason shown read-only. */
export interface LibraryOrganizeSkip extends LibraryOrganizeMove {
  skipped: 'in-use';
}

export interface LibraryOrganizeSuggestResponse {
  success: boolean;
  moves?: LibraryOrganizeMove[];
  /** "In use, close the project to move." */
  skipped?: LibraryOrganizeSkip[];
  /** Suggestions dropped as unusable (unknown path, collision, no-op). */
  discarded?: number;
  error?: string;
}

/** library:organize:apply — only the moves the user accepted, verbatim. */
export interface LibraryOrganizeApplyRequest {
  moves: LibraryOrganizeMove[];
  /** Re-checked in main before anything moves — the renderer is not trusted
   *  to have kept the skip list honest between suggest and apply. */
  openProjectId?: string;
}

export interface LibraryOrganizeApplyResponse {
  success: boolean;
  moved?: number;
  /** Per-move failures; applying is per-item, never batch-fatal. */
  failures?: Array<{ relPath: string; error: string }>;
  /** Moves refused at apply time because the asset became in-use. */
  refused?: string[];
  /** The re-keyed index after the moves landed. */
  entries?: LibraryIndexEntry[];
  error?: string;
}

// ─── Brands (L3/D11) ───

/** library:brands:get — every brand plus the app-wide default pointer. */
export interface LibraryBrandsGetResponse {
  success: boolean;
  brands?: StudioBrand[];
  defaultBrandId?: string;
  error?: string;
}

/** library:brand:save — create (no brandId) or update (brandId) one brand. */
export interface LibraryBrandSaveRequest {
  brandId?: string;
  input: StudioBrandInput;
}

export interface LibraryBrandSaveResponse {
  success: boolean;
  brand?: StudioBrand;
  error?: string;
}

/** library:brand:delete — remove brands/<id>/; clears the default if it pointed there. */
export interface LibraryBrandDeleteRequest {
  brandId: string;
}

export interface LibraryBrandDeleteResponse {
  success: boolean;
  error?: string;
}

/** library:brand:default:set — set or clear (null) the app-wide default brand. */
export interface LibraryBrandDefaultSetRequest {
  brandId: string | null;
}

export interface LibraryBrandDefaultSetResponse {
  success: boolean;
  error?: string;
}

// ─── Editing presets (V1 completion plan §2.5) ───

/** library:presets:get — every preset (with its PRESET.md body); the
 *  built-ins are seeded into the library on the first call. */
export interface LibraryPresetsGetResponse {
  success: boolean;
  presets?: StudioPresetEntry[];
  error?: string;
}

/** library:preset:save — create (no presetId) or update (presetId) one preset. */
export interface LibraryPresetSaveRequest {
  presetId?: string;
  input: StudioPresetInput;
}

export interface LibraryPresetSaveResponse {
  success: boolean;
  preset?: StudioPresetEntry;
  error?: string;
}

/** library:preset:delete — remove presets/<id>/ (body and skills included). */
export interface LibraryPresetDeleteRequest {
  presetId: string;
}

export interface LibraryPresetDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Visible web capture handshake (L6/D12) ───

/** library:capture:event — pushed while a VISIBLE capture waits for the user
 *  ('pending' shows the chip, 'closed' hides it). */
export interface LibraryCaptureEvent {
  state: 'pending' | 'closed';
  url?: string;
}

/** library:capture:trigger — the chip's buttons: take the shot, or abandon. */
export interface LibraryCaptureTriggerRequest {
  action: 'capture' | 'cancel';
}

export interface LibraryCaptureTriggerResponse {
  success: boolean;
  error?: string;
}
