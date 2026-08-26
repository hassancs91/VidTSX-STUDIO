// IPC contract for `.vidtsx` project packages (NEXT_FEATURES_DESIGN.md Q7).
//
// Export is two calls: PLAN (sizes, warnings — recomputed on every strategy
// flip in the dialog, writes nothing) then EXPORT (save dialog + the write).
// Progress rides a push event because a full-media package is minutes of copy.

import type { StudioProject } from '../../types/studio';
import type {
  PackageAssetEntry,
  PackageKind,
  PackageMediaStrategy,
} from '../../studio/project-package';

/** One row of the export dialog's asset table. */
export interface StudioPackagePlanAsset {
  assetId: string;
  /** Basename on this machine. */
  name: string;
  kind: 'video' | 'audio' | 'image';
  /** Bytes this asset contributes under the chosen strategy. */
  bytes: number;
  /** Bytes the original occupies on disk (shown when nothing travels). */
  originalBytes: number;
  proxyOnly?: boolean;
  /** Why nothing travels: file gone, no proxy yet, or the chosen strategy. */
  skip?: 'missing' | 'no-proxy' | 'by-strategy';
}

export interface StudioPackagePlanSummary {
  strategy: PackageMediaStrategy;
  assets: StudioPackagePlanAsset[];
  mediaBytes: number;
  extrasBytes: number;
  totalBytes: number;
  counts: { assets: number; media: number; shots: number; transcripts: number };
  kitVersion?: string;
  captionPacks: string[];
  warnings: string[];
}

export interface StudioPackagePlanRequest {
  project: StudioProject;
  strategy: PackageMediaStrategy;
  /** Q7b: the private conversations (project + per-shot). Default OFF. */
  includeChat?: boolean;
}

export interface StudioPackagePlanResponse {
  success: boolean;
  plan?: StudioPackagePlanSummary;
  error?: string;
}

export interface StudioPackageExportRequest {
  project: StudioProject;
  strategy: PackageMediaStrategy;
  includeChat?: boolean;
  /** Skip the save dialog (used by tests and future scripted exports). */
  destPath?: string;
}

export interface StudioPackageExportResponse {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  /** Uncompressed footprint an import will write. */
  bytes?: number;
  kind?: PackageKind;
  assets?: PackageAssetEntry[];
  warnings?: string[];
  error?: string;
}

/** Push progress for a long export/import. */
export interface StudioPackageEvent {
  op: 'export' | 'import';
  percent: number;
  message: string;
}

// ─── Import (Q7d) ───────────────────────────────────────────────────────────

/** The brand tokens a package carries, as the import dialog shows them. */
export interface StudioPackageBrandSnapshot {
  name: string;
  palette: { primary: string; secondary: string; background: string; text: string; accent: string };
  fonts: { display: string; body?: string };
  styleNotes?: string;
}

/** What a package says about itself, read without writing anything. */
export interface StudioPackageInfo {
  filePath: string;
  formatVersion: number;
  schemaVersion: number;
  kind: PackageKind;
  app: { name: string; version: string };
  createdAt: string;
  project: { name: string; width: number; height: number; fps: number };
  mediaStrategy: PackageMediaStrategy;
  counts: { assets: number; media: number; shots: number; transcripts: number };
  totalBytes: number;
  kitVersion?: string;
  captionPacks?: string[];
  hasAgentChat: boolean;
  brandSnapshot?: StudioPackageBrandSnapshot;
  /** Set when this build cannot open the package — the reason, in one line. */
  incompatible?: string;
}

export interface StudioPackageInspectRequest {
  /** Omitted → main opens the OS file picker. */
  filePath?: string;
}

export interface StudioPackageInspectResponse {
  success: boolean;
  /** The picker was dismissed — not an error. */
  canceled?: boolean;
  info?: StudioPackageInfo;
  error?: string;
}

/** Q7f brand offer, resolved in the dialog before the import runs. */
export type StudioPackageBrandChoice =
  | { mode: 'match'; brandId: string }
  | { mode: 'create' }
  | { mode: 'snapshot' }
  | { mode: 'none' };

export interface StudioPackageShotReport {
  shotId: string;
  name: string;
  /** ready · convert (only the allowlist gap) · error (needs a manual edit). */
  verdict: 'ready' | 'convert' | 'error';
  error?: string;
}

export interface StudioPackageRelinkItem {
  assetId: string;
  name: string;
  reason: 'no-media' | 'proxy-only';
}

export interface StudioPackageImportReport {
  projectId: string;
  name: string;
  kind: PackageKind;
  shots: StudioPackageShotReport[];
  relink: StudioPackageRelinkItem[];
  captionPacks: Array<{ packId: string; installed: boolean; reason?: string }>;
  kit?: { version: string; installed: boolean };
  brand: { applied: StudioPackageBrandChoice['mode']; brandId?: string; error?: string };
  warnings: string[];
}

export interface StudioPackageImportRequest {
  filePath: string;
  /** Rename on import; defaults to the package's project name. */
  name?: string;
  brand?: StudioPackageBrandChoice;
}

export interface StudioPackageImportResponse {
  success: boolean;
  report?: StudioPackageImportReport;
  error?: string;
}
