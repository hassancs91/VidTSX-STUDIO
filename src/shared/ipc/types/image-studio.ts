// ─── Image generation types ───
import type { ContentSafetyBlockInfo } from '../../content-safety/types';

export type ImageOperationType = 'text-to-image' | 'image-to-image' | 'multi-reference';

/** CLI-bridge types are registered directly and never stored in provider settings. */
export type ImageProviderType =
  | 'fal'
  | 'openrouter'
  | 'cloudflare'
  | 'local'
  | 'gemini-cli'
  | 'minimax-cli';

export interface ImageProviderInfo {
  id: string;
  name: string;
  type: ImageProviderType;
  defaultModel: string;
  enabled: boolean;
  hasApiKey: boolean;
}

export interface ImageModelInfoIpc {
  id: string;
  name: string;
  supportedOperations: ImageOperationType[];
  /** Credit cost per generation, when the provider charges credits (VidTSX). */
  credits?: number;
}

export interface ImageProvidersGetResponse {
  success: boolean;
  providers: ImageProviderInfo[];
  activeProvider: string | null;
  error?: string;
}

export interface ImageProvidersSaveRequest {
  providers: Array<{
    id: string;
    name: string;
    type: ImageProviderType;
    apiKey: string;
    defaultModel: string;
    enabled: boolean;
  }>;
  activeProvider?: string;
}

export interface ImageProvidersSaveResponse {
  success: boolean;
  error?: string;
}

export interface ImageProviderTestRequest {
  providerId: string;
  /** Draft API key — if set, takes precedence over the saved key for this test only */
  apiKey?: string;
  /** Draft default model — if set, takes precedence over the saved one for this test only */
  defaultModel?: string;
  /** Draft Cloudflare account id — if set, takes precedence over the saved one for this test only */
  accountId?: string;
}

export interface ImageProviderTestResponse {
  success: boolean;
  durationMs?: number;
  error?: string;
}

export interface ImageModelsGetRequest {
  providerId?: string;
}

export interface ImageModelsGetResponse {
  success: boolean;
  models: ImageModelInfoIpc[];
  error?: string;
}

export interface ImageGenerateRequest {
  operation: ImageOperationType;
  prompt: string;
  // When set, routes to this specific provider via imageEngine.generateWith().
  // When omitted, falls back to the engine's active provider (Image Studio's
  // historical behavior).
  providerId?: string;
  // Caller-supplied id (e.g. flow run id) that pairs this call with a later
  // imageGenerateCancel. Without it, the call cannot be aborted mid-flight.
  callId?: string;
  model?: string;
  width?: number;
  height?: number;
  numImages?: number;
  sourceImage?: string;
  referenceImages?: string[];
  outputFormat?: 'png' | 'jpeg' | 'webp';
}

export interface ImageGenerateResponse {
  success: boolean;
  images?: Array<{
    base64: string;
    width: number;
    height: number;
    contentType: string;
  }>;
  model?: string;
  durationMs?: number;
  error?: string;
  /** Set when Content Safety blocked the request (error carries the copy). */
  blocked?: ContentSafetyBlockInfo;
}

export interface ImageGenerateCancelRequest {
  callId: string;
}

export interface ImageGenerateCancelResponse {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

// ─── CLI-bridge provider status (setup cards) ───
export interface ImageCliStatusRequest {
  /** Force a fresh probe (the "Check again" button); otherwise a recent result may be reused. */
  force?: boolean;
}

export interface ImageCliProviderStatus {
  /** Provider id: 'gemini-cli' today; 'minimax-cli' when the mmx provider lands. */
  id: string;
  installed: boolean;
  authenticated: boolean;
  binaryPath: string;
  /** Short failure detail when the auth probe did not succeed. */
  detail?: string;
}

export interface ImageCliStatusResponse {
  success: boolean;
  statuses: ImageCliProviderStatus[];
  error?: string;
}

export interface ImageProviderSwitchRequest {
  providerId: string;
}

export interface ImageProviderSwitchResponse {
  success: boolean;
  error?: string;
}

// ─── Image Studio persistence types ───
export interface ImageStudioFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface ImageStudioManifest {
  folders: ImageStudioFolder[];
  images: ImageStudioEntry[];
  references: ReferenceImageEntry[];
}

// ─── Reference image library types ───
export interface ReferenceImageEntry {
  id: string;
  fileName: string;
  originalName: string;
  contentType: string;
  createdAt: number;
  enabled: boolean;
}

export interface RefImageSaveRequest {
  base64: string;
  originalName: string;
  contentType: string;
}

export interface RefImageSaveResponse {
  success: boolean;
  entry?: ReferenceImageEntry;
  error?: string;
}

export interface RefImageListResponse {
  success: boolean;
  entries: ReferenceImageEntry[];
  error?: string;
}

export interface RefImageDeleteRequest {
  id: string;
}

export interface RefImageDeleteResponse {
  success: boolean;
  error?: string;
}

export interface RefImageToggleRequest {
  id: string;
  enabled: boolean;
}

export interface RefImageToggleResponse {
  success: boolean;
  error?: string;
}

export interface RefImageReadRequest {
  id: string;
}

export interface RefImageReadResponse {
  success: boolean;
  base64?: string;
  error?: string;
}

// ─── Image Studio entries ───
export interface ImageStudioEntry {
  id: string;
  fileName: string;
  prompt: string;
  model: string;
  width: number | null;
  height: number | null;
  contentType: string;
  createdAt: number;
  durationMs: number;
  folderId?: string | null;
  /** Id of the gallery image this one was derived from (e.g. "Remove background"). */
  derivedFrom?: string | null;
}

export interface ImageStudioSaveRequest {
  base64: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  contentType: string;
  durationMs: number;
  folderId?: string | null;
}

export interface ImageStudioSaveResponse {
  success: boolean;
  entry?: ImageStudioEntry;
  error?: string;
}

export interface ImageStudioListResponse {
  success: boolean;
  entries: ImageStudioEntry[];
  folders: ImageStudioFolder[];
  basePath: string;
  error?: string;
}

export interface ImageStudioDeleteRequest {
  id: string;
}

export interface ImageStudioDeleteResponse {
  success: boolean;
  error?: string;
}

export interface ImageStudioSaveAsRequest {
  id: string;
}

export interface ImageStudioSaveAsResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ImageStudioCopyRequest {
  id: string;
}

export interface ImageStudioCopyResponse {
  success: boolean;
  error?: string;
}

export interface ImageStudioReadRequest {
  id: string;
}

export interface ImageStudioReadResponse {
  success: boolean;
  base64?: string;
  error?: string;
}

// ─── Image Studio folder types ───
export interface ImageStudioFolderCreateRequest {
  name: string;
}

export interface ImageStudioFolderCreateResponse {
  success: boolean;
  folder?: ImageStudioFolder;
  error?: string;
}

export interface ImageStudioFolderRenameRequest {
  id: string;
  name: string;
}

export interface ImageStudioFolderRenameResponse {
  success: boolean;
  error?: string;
}

export interface ImageStudioFolderDeleteRequest {
  id: string;
  deleteImages: boolean;
}

export interface ImageStudioFolderDeleteResponse {
  success: boolean;
  error?: string;
}

export interface ImageStudioMoveToFolderRequest {
  imageIds: string[];
  folderId: string | null;
}

export interface ImageStudioMoveToFolderResponse {
  success: boolean;
  error?: string;
}

// ─── Prompt presets ───
export interface ContentPresetSetting {
  id: string;
  label: string;
  aspectRatio: string;
  promptSuffix: string;
}

export interface StylePresetSetting {
  id: string;
  label: string;
  promptSuffix: string;
}

export interface PromptPresetsGetResponse {
  contentPresets: ContentPresetSetting[];
  stylePresets: StylePresetSetting[];
}

export interface PromptPresetsSaveRequest {
  contentPresets: ContentPresetSetting[];
  stylePresets: StylePresetSetting[];
}
