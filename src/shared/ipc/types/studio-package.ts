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
