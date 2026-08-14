import fs from 'fs/promises';
import path from 'path';
import type {
  LibraryBrandDefaultSetRequest,
  LibraryBrandDefaultSetResponse,
  LibraryBrandDeleteRequest,
  LibraryBrandDeleteResponse,
  LibraryBrandSaveRequest,
  LibraryBrandSaveResponse,
  LibraryBrandsGetResponse,
  LibraryDescriptionSetRequest,
  LibraryDescriptionSetResponse,
  LibraryIndexGetResponse,
  LibraryRootGetResponse,
  LibraryRootSetRequest,
  LibraryRootSetResponse,
  LibrarySizesGetResponse,
} from '@shared/ipc/types';
import { getDefaultBrandId, setDefaultBrandId } from '../services/library/brand-default';
import {
  createBrand,
  deleteBrand,
  listBrands,
  readBrand,
  updateBrand,
} from '../services/library/brand-store';
import {
  ensureLibraryRoot,
  getDefaultLibraryRoot,
  getLibraryRootOverride,
  setLibraryRootOverride,
} from '../services/library/library-paths';
import { scanLibrary, setDescription } from '../services/library/library-store';
import { getLibrarySizes } from '../services/library/library-sizes';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** library:index:get — scan + reconcile, return the fresh entries. */
export async function handleLibraryIndexGet(): Promise<LibraryIndexGetResponse> {
  try {
    const root = await ensureLibraryRoot();
    const entries = await scanLibrary(root);
    return { success: true, root, entries };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryDescriptionSet(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryDescriptionSetRequest
): Promise<LibraryDescriptionSetResponse> {
  try {
    const root = await ensureLibraryRoot();
    await setDescription(root, data.relPath, data.description);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibrarySizesGet(): Promise<LibrarySizesGetResponse> {
  try {
    const root = await ensureLibraryRoot();
    return { success: true, sizes: await getLibrarySizes(root) };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryRootGet(): Promise<LibraryRootGetResponse> {
  try {
    const root = await ensureLibraryRoot();
    return {
      success: true,
      root,
      defaultRoot: getDefaultLibraryRoot(),
      isOverride: getLibraryRootOverride() !== undefined,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ─── Brands (L3/D11) ───

export async function handleLibraryBrandsGet(): Promise<LibraryBrandsGetResponse> {
  try {
    const root = await ensureLibraryRoot();
    const brands = await listBrands(root);
    const defaultBrandId = getDefaultBrandId();
    return {
      success: true,
      brands,
      // Surface the default only while it points at a real brand — a stale
      // pointer (deleted outside the app) reads as "no default".
      ...(defaultBrandId && brands.some((b) => b.id === defaultBrandId)
        ? { defaultBrandId }
        : {}),
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryBrandSave(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryBrandSaveRequest
): Promise<LibraryBrandSaveResponse> {
  try {
    const root = await ensureLibraryRoot();
    const brand = data.brandId
      ? await updateBrand(root, data.brandId, data.input)
      : await createBrand(root, data.input);
    return { success: true, brand };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryBrandDelete(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryBrandDeleteRequest
): Promise<LibraryBrandDeleteResponse> {
  try {
    const root = await ensureLibraryRoot();
    await deleteBrand(root, data.brandId);
    if (getDefaultBrandId() === data.brandId) setDefaultBrandId(null);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryBrandDefaultSet(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryBrandDefaultSetRequest
): Promise<LibraryBrandDefaultSetResponse> {
  try {
    if (data.brandId !== null) {
      const root = await ensureLibraryRoot();
      if (!(await readBrand(root, data.brandId))) {
        return { success: false, error: `Brand not found: ${data.brandId}` };
      }
    }
    setDefaultBrandId(data.brandId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

/**
 * Set or clear (null) the assets-root override. The folder must already
 * exist — changing the root never moves files (the user moves the folder,
 * then points the setting at it; the index travels inside).
 */
export async function handleLibraryRootSet(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryRootSetRequest
): Promise<LibraryRootSetResponse> {
  try {
    if (data.root !== null) {
      if (!path.isAbsolute(data.root)) {
        return { success: false, error: 'Assets root must be an absolute path' };
      }
      const stat = await fs.stat(data.root).catch(() => null);
      if (!stat?.isDirectory()) {
        return { success: false, error: 'Assets root must be an existing folder' };
      }
    }
    setLibraryRootOverride(data.root);
    return { success: true, root: await ensureLibraryRoot() };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}
