// Templates IPC (docs/templates-plan.md §5).

import type { InstalledTemplate, TemplateSavedState } from '../../types/templates';

/** A template as the gallery shows it. */
export interface TemplateIpc extends InstalledTemplate {
  /** Module-server url of `manifest.thumbnail`; absent when there is none. */
  thumbnailUrl?: string;
}

export interface TemplatesListResponse {
  templates: TemplateIpc[];
  error?: string;
}

export interface TemplatesStageRequest {
  id: string;
  /** A format value from the manifest; a stale one falls back to the default. */
  format?: string;
}

export interface TemplatesStageResponse {
  success: boolean;
  /** The staged entry — what the preview loads and the render bundles. */
  entryPath?: string;
  /** Where a relative image value (`assets/bg.jpg`) resolves. */
  workDir?: string;
  /** The format that was applied. */
  format?: string | null;
  /** `<base>/asset?path=` shows a local image in the form. */
  assetBaseUrl?: string;
  error?: string;
}

export interface TemplatesStateLoadRequest {
  id: string;
}

export interface TemplatesStateLoadResponse {
  state: TemplateSavedState | null;
}

export interface TemplatesStateSaveRequest {
  id: string;
  state: TemplateSavedState;
}

export interface TemplatesStateSaveResponse {
  success: boolean;
  error?: string;
}
