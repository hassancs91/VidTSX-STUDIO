// ─── Generic model-library IPC types (category-agnostic) ───
import type { ModelCategory, ModelIssue, ModelUsageRecord } from '../../model-library/types';
import type { FitResult } from '../../model-library/fit';

/** Config a user picks in the Set-up dialog for a custom/unrecognized model. */
export interface ModelSetupConfig {
  /** Category-specific family key (image: sd15/sdxl/sd3/flux1/flux2). */
  family: string;
  name?: string;
  allInOne?: boolean;
}

/** An installed (scanned) model, ready for the library UI. */
export interface InstalledModelIpc {
  id: string;
  name: string;
  family: string;
  sizeBytes: number;
  filePath: string;
  origin: 'profile' | 'custom';
  /** True when there are no blocking issues (all companions present, file exists). */
  ready: boolean;
  issues: ModelIssue[];
  capabilities: { txt2img: boolean; img2img: boolean; reference: boolean };
  lastUsedAt: string | null;
  useCount: number;
  /** VRAM/RAM fit verdict vs the detected hardware. Absent when hardware is undetectable. */
  fit?: FitResult;
}

/** A catalog profile (whether or not it is installed). */
export interface ProfileModelIpc {
  id: string;
  name: string;
  family: string;
  sizeLabel: string;
  sourceUrl: string;
  /** True when a public one-click download is available (D1). */
  hasDownload: boolean;
  installed: boolean;
  /** VRAM/RAM fit verdict vs the detected hardware. Absent when hardware is undetectable. */
  fit?: FitResult;
}

export interface CompanionFileIpc {
  fileName: string;
  kind: string;
}

export interface UnrecognizedFileIpc {
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export interface ModelsScanRequest {
  category: ModelCategory;
}

export interface ModelsScanResponse {
  category: ModelCategory;
  /** The models folder that was scanned (empty when unsupported). */
  folder: string;
  installed: InstalledModelIpc[];
  profiles: ProfileModelIpc[];
  unrecognized: UnrecognizedFileIpc[];
  companions: CompanionFileIpc[];
  error?: string;
}

export interface ModelsImportRequest {
  category: ModelCategory;
  sourcePath: string;
  mode: 'move' | 'copy';
  setup?: ModelSetupConfig;
}

export interface ModelsImportResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ModelsConfigureRequest {
  category: ModelCategory;
  filePath: string;
  setup: ModelSetupConfig;
}

export interface ModelsConfigureResponse {
  success: boolean;
  error?: string;
}

export interface ModelsRemoveRequest {
  category: ModelCategory;
  modelId: string;
  deleteFile: boolean;
}

export interface ModelsRemoveResponse {
  success: boolean;
  error?: string;
}

export interface ModelsUsageGetRequest {
  category: ModelCategory;
}

export interface ModelsUsageGetResponse {
  usage: Record<string, ModelUsageRecord>;
}

export interface ModelsOpenFolderRequest {
  category: ModelCategory;
}

export interface ModelsOpenFolderResponse {
  success: boolean;
  error?: string;
}

export interface ModelsSetFolderRequest {
  category: ModelCategory;
  folderPath: string;
}

export interface ModelsSetFolderResponse {
  success: boolean;
  folder?: string;
  error?: string;
}
