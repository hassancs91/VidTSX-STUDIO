// Studio — brand fonts (video-10 import gap 10): the local stylesheet URLs
// for the fonts of the brand a project resolves to (library brand, or the
// project-local snapshot of an imported package).

export interface StudioBrandFontsGetRequest {
  projectId: string;
  /** `project.settings.brandId`; absent resolves the project-local snapshot, if any. */
  brandId?: string;
}

export interface StudioBrandFontsGetResponse {
  success: boolean;
  /** Families that resolved to a cached Google Fonts stylesheet. */
  families?: string[];
  /** One stylesheet URL per family, on the module server's font proxy. */
  stylesheets?: string[];
  error?: string;
}
