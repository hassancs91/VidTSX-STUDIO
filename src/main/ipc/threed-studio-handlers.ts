import { BrowserWindow, dialog, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  ThreedStudioDeleteRequest,
  ThreedStudioDeleteResponse,
  ThreedStudioListResponse,
  ThreedStudioOpenFolderRequest,
  ThreedStudioOpenFolderResponse,
  ThreedStudioReadRequest,
  ThreedStudioReadResponse,
  ThreedStudioSaveAsRequest,
  ThreedStudioSaveAsResponse,
  ThreedStudioSaveToLibraryRequest,
  ThreedStudioSaveToLibraryResponse,
} from '../../shared/ipc/types';
import { deleteModel, getModelPaths, listModels } from '../services/threed-studio-db';
import { getModelsDir } from '../services/threed-studio-files';
import { ensureLibraryRoot } from '../services/library/library-paths';
import { upsertEntry } from '../services/library/library-store';
import { reserveLibraryFile, sanitizeFolder, slugify } from '../services/library/library-filing';

/** Default library folder for saved meshes (plan §5 step 3). */
export const LIBRARY_3D_FOLDER = 'generated/3d';

export async function handleThreedStudioList(): Promise<ThreedStudioListResponse> {
  try {
    const { entries, basePath } = await listModels();
    return { success: true, entries, basePath };
  } catch (err) {
    return { success: false, entries: [], basePath: '', error: err instanceof Error ? err.message : 'Failed to list models' };
  }
}

export async function handleThreedStudioRead(_event: IpcMainInvokeEvent, req: ThreedStudioReadRequest): Promise<ThreedStudioReadResponse> {
  try {
    const paths = getModelPaths(req.id);
    if (!paths) return { success: false, error: 'Model not found' };
    return { success: true, entry: paths.entry, meshPath: paths.mesh, previewPath: paths.preview, inputPath: paths.input };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to read model' };
  }
}

export async function handleThreedStudioDelete(_event: IpcMainInvokeEvent, req: ThreedStudioDeleteRequest): Promise<ThreedStudioDeleteResponse> {
  try {
    await deleteModel(req.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete model' };
  }
}

export async function handleThreedStudioSaveAs(_event: IpcMainInvokeEvent, req: ThreedStudioSaveAsRequest): Promise<ThreedStudioSaveAsResponse> {
  try {
    const paths = getModelPaths(req.id);
    if (!paths) return { success: false, error: 'Model not found' };
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No focused window' };
    const result = await dialog.showSaveDialog(win, {
      title: 'Save 3D model',
      defaultPath: `${slugify(paths.entry.name, 'model')}.glb`,
      filters: [{ name: 'GLB 3D model', extensions: ['glb'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, error: 'Save cancelled' };
    await fs.copyFile(paths.mesh, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save model' };
  }
}

/**
 * Copy the GLB (and its preview as a sibling PNG) into the asset library under
 * generated/3d/ as born-managed content; the library already classifies .glb as model3d.
 */
export async function handleThreedStudioSaveToLibrary(_event: IpcMainInvokeEvent, req: ThreedStudioSaveToLibraryRequest): Promise<ThreedStudioSaveToLibraryResponse> {
  try {
    const paths = getModelPaths(req.id);
    if (!paths) return { success: false, error: 'Model not found' };
    const root = await ensureLibraryRoot();
    const folder = sanitizeFolder(req.folder, LIBRARY_3D_FOLDER);
    const base = slugify(paths.entry.name, 'model');
    const { relPath, absPath } = await reserveLibraryFile(root, folder, base, '.glb');
    await fs.copyFile(paths.mesh, absPath);
    const description = `3D model of ${paths.entry.sourceImageName} (TripoSR, ${paths.entry.quality}³)`;
    await upsertEntry(root, relPath, { origin: 'generated', description });
    if (paths.preview) {
      const previewAbs = path.join(path.dirname(absPath), `${path.basename(absPath, '.glb')}-preview.png`);
      await fs.copyFile(paths.preview, previewAbs).catch(() => {});
      await upsertEntry(root, `${folder}/${path.basename(previewAbs)}`, { origin: 'generated', description: `Preview of ${path.basename(relPath)}` }).catch(() => {});
    }
    return { success: true, relPath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save to the library' };
  }
}

export async function handleThreedStudioOpenFolder(_event: IpcMainInvokeEvent, req: ThreedStudioOpenFolderRequest = {}): Promise<ThreedStudioOpenFolderResponse> {
  try {
    if (req.id) {
      const paths = getModelPaths(req.id);
      if (!paths) return { success: false, error: 'Model not found' };
      shell.showItemInFolder(paths.mesh);
    } else {
      await fs.mkdir(getModelsDir(), { recursive: true });
      await shell.openPath(getModelsDir());
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to open folder' };
  }
}
