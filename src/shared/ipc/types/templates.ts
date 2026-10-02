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

// ─── Importer (plan §7): a `.vidtsxtemplate` into `<userData>/templates` ───

export interface TemplatesImportRequest {
  /** The package; absent = the OS picker (VIDTSX_TEMPLATE_PICK stands in for it). */
  path?: string;
  /** Replace an installed copy with an older version. */
  confirmDowngrade?: boolean;
}

export interface TemplatesImportResponse {
  success: boolean;
  template?: TemplateIpc;
  /** How the package was signed: 'verified' (with `publisher`), 'signed-unknown' or 'unsigned'. */
  signature?: { status: 'verified' | 'signed-unknown' | 'unsigned'; publisher?: string };
  /** An older version than the installed one: ask, then re-send with `confirmDowngrade`. */
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  /** The package path, echoed so a confirm can re-send it. */
  path?: string;
  canceled?: boolean;
  error?: string;
}

export interface TemplatesRemoveRequest {
  id: string;
}

export interface TemplatesRemoveResponse {
  success: boolean;
  error?: string;
}

/** A double-clicked `.vidtsxtemplate` waiting in main (pending-open.ts). */
export interface TemplatesPendingPackageResponse {
  filePath?: string;
}

/** Pushed main → renderer on a double-click: navigation only; the path stays parked. */
export interface TemplatesPackageOpenFileEvent {
  filePath?: string;
}
