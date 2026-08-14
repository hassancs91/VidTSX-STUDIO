import type { LibraryIndexEntry, LibrarySizes, StudioBrand } from '../../types/asset-library';
import type { StudioBrandInput } from '../../studio/brand';

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
