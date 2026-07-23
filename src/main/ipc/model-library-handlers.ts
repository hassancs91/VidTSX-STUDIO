import type { IpcMainInvokeEvent } from 'electron';
import { shell } from 'electron';
import type {
  InstalledModelIpc,
  ModelsConfigureRequest,
  ModelsConfigureResponse,
  ModelsImportRequest,
  ModelsImportResponse,
  ModelsOpenFolderRequest,
  ModelsOpenFolderResponse,
  ModelsRemoveRequest,
  ModelsRemoveResponse,
  ModelSetupConfig,
  ModelsScanRequest,
  ModelsScanResponse,
  ModelsSetFolderRequest,
  ModelsSetFolderResponse,
  ModelsUsageGetRequest,
  ModelsUsageGetResponse,
  ProfileModelIpc,
} from '../../shared/ipc/types';
import type { InstalledModel } from '../../shared/model-library/types';
import type { SdModelFamily, SdModelMeta } from '../../local-image-engine/types';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import { SD_FAMILIES } from '../../local-image-engine/family-presets';
import {
  configureImageModel,
  getImageModelsDir,
  importImageModel,
  removeImageModel,
  scanImageLibrary,
  type SetupConfig,
} from '../services/sdimage-library';
import {
  fitFor,
  requirementForInstalled,
  requirementForProfile,
} from '../services/sdimage-preflight';
import { getPreflightHardware, type PreflightHardware } from '../services/system-info';
import { usageStore } from '../services/model-usage';
import { setImageModelsFolder } from '../services/settings';
import type { VideoModelMeta } from '../../local-video-engine/types';
import { VIDEO_MODEL_CATALOG } from '../../local-video-engine/model-registry';
import {
  getVideoModelsDir,
  removeVideoModel,
  scanVideoLibrary,
} from '../services/sdvideo-library';

function isImage(category: string): boolean {
  return category === 'image';
}

function isVideo(category: string): boolean {
  return category === 'video';
}

function toSetupConfig(setup: ModelSetupConfig): SetupConfig {
  if (!(SD_FAMILIES as string[]).includes(setup.family)) {
    throw new Error(`Unsupported family: ${setup.family}`);
  }
  return {
    family: setup.family as SdModelFamily,
    name: setup.name,
    allInOne: setup.allInOne,
  };
}

function toInstalledIpc(
  model: InstalledModel<SdModelMeta>,
  usage: Record<string, { lastUsedAt: string; useCount: number }>,
  hardware: PreflightHardware,
): InstalledModelIpc {
  const record = usage[model.id];
  return {
    id: model.id,
    name: model.name,
    family: model.meta.family,
    sizeBytes: model.sizeBytes,
    filePath: model.filePath,
    origin: model.origin,
    ready: model.issues.length === 0,
    issues: model.issues,
    capabilities: model.meta.capabilities,
    lastUsedAt: record?.lastUsedAt ?? null,
    useCount: record?.useCount ?? 0,
    fit: fitFor(requirementForInstalled(model), hardware),
  };
}

/** Video capabilities mapped into the (image-shaped) IPC capability slot. */
function videoInstalledToIpc(
  model: InstalledModel<VideoModelMeta>,
  usage: Record<string, { lastUsedAt: string; useCount: number }>,
  hardware: PreflightHardware,
): InstalledModelIpc {
  const record = usage[model.id];
  const profile = VIDEO_MODEL_CATALOG.find((p) => p.id === model.id);
  return {
    id: model.id,
    name: model.name,
    family: model.meta.family,
    sizeBytes: model.sizeBytes,
    filePath: model.filePath,
    origin: model.origin,
    ready: model.issues.length === 0,
    issues: model.issues,
    capabilities: {
      txt2img: model.meta.capabilities.t2v,
      img2img: model.meta.capabilities.i2v,
      reference: false,
    },
    lastUsedAt: record?.lastUsedAt ?? null,
    useCount: record?.useCount ?? 0,
    fit: fitFor(
      { minVramGB: profile?.requirements?.minVramGB, sizeBytes: model.sizeBytes },
      hardware,
    ),
  };
}

async function scanVideoCategory(): Promise<ModelsScanResponse> {
  const scan = await scanVideoLibrary();
  const usage = usageStore.getFor('video');
  const hardware = await getPreflightHardware();
  const installedIds = new Set(scan.installed.map((m) => m.id));

  const profiles: ProfileModelIpc[] = VIDEO_MODEL_CATALOG.map((p) => ({
    id: p.id,
    name: p.name,
    family: p.meta.family,
    sizeLabel: p.sizeLabel,
    sourceUrl: p.sourceUrl,
    hasDownload: Boolean(p.downloadUrl),
    installed: installedIds.has(p.id),
    fit: fitFor({ minVramGB: p.requirements?.minVramGB, sizeBytes: p.sizeBytes }, hardware),
  }));

  return {
    category: 'video',
    folder: scan.root,
    installed: scan.installed.map((m) => videoInstalledToIpc(m, usage, hardware)),
    profiles,
    unrecognized: scan.unrecognized,
    companions: scan.companionsFound.map((c) => ({ fileName: c.fileName, kind: c.kind })),
  };
}

export async function handleModelsScan(
  _event: IpcMainInvokeEvent,
  req: ModelsScanRequest,
): Promise<ModelsScanResponse> {
  const empty: ModelsScanResponse = {
    category: req.category,
    folder: '',
    installed: [],
    profiles: [],
    unrecognized: [],
    companions: [],
  };

  if (isVideo(req.category)) {
    try {
      return await scanVideoCategory();
    } catch (err) {
      return { ...empty, error: err instanceof Error ? err.message : 'Scan failed' };
    }
  }

  if (!isImage(req.category)) {
    return { ...empty, error: 'unsupported-category' };
  }

  try {
    const scan = await scanImageLibrary();
    const usage = usageStore.getFor('image');
    const hardware = await getPreflightHardware();
    const installedIds = new Set(scan.installed.map((m) => m.id));

    const profiles: ProfileModelIpc[] = SD_MODEL_CATALOG.map((p) => ({
      id: p.id,
      name: p.name,
      family: p.meta.family,
      sizeLabel: p.sizeLabel,
      sourceUrl: p.sourceUrl,
      hasDownload: Boolean(p.downloadUrl),
      installed: installedIds.has(p.id),
      fit: fitFor(requirementForProfile(p), hardware),
    }));

    return {
      category: 'image',
      folder: scan.root,
      installed: scan.installed.map((m) => toInstalledIpc(m, usage, hardware)),
      profiles,
      unrecognized: scan.unrecognized,
      companions: scan.companionsFound.map((c) => ({ fileName: c.fileName, kind: c.kind })),
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'Scan failed' };
  }
}

export async function handleModelsImport(
  _event: IpcMainInvokeEvent,
  req: ModelsImportRequest,
): Promise<ModelsImportResponse> {
  if (!isImage(req.category)) {
    return { success: false, error: 'unsupported-category' };
  }
  try {
    const setup = req.setup ? toSetupConfig(req.setup) : undefined;
    const { filePath } = await importImageModel(req.sourcePath, req.mode, setup);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Import failed' };
  }
}

export async function handleModelsConfigure(
  _event: IpcMainInvokeEvent,
  req: ModelsConfigureRequest,
): Promise<ModelsConfigureResponse> {
  if (!isImage(req.category)) {
    return { success: false, error: 'unsupported-category' };
  }
  try {
    await configureImageModel(req.filePath, toSetupConfig(req.setup));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Configure failed' };
  }
}

export async function handleModelsRemove(
  _event: IpcMainInvokeEvent,
  req: ModelsRemoveRequest,
): Promise<ModelsRemoveResponse> {
  if (!isImage(req.category) && !isVideo(req.category)) {
    return { success: false, error: 'unsupported-category' };
  }
  try {
    if (isVideo(req.category)) {
      await removeVideoModel(req.modelId, { deleteFile: req.deleteFile });
    } else {
      await removeImageModel(req.modelId, { deleteFile: req.deleteFile });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Remove failed' };
  }
}

export async function handleModelsUsageGet(
  _event: IpcMainInvokeEvent,
  req: ModelsUsageGetRequest,
): Promise<ModelsUsageGetResponse> {
  return { usage: usageStore.getFor(req.category) };
}

export async function handleModelsOpenFolder(
  _event: IpcMainInvokeEvent,
  req: ModelsOpenFolderRequest,
): Promise<ModelsOpenFolderResponse> {
  if (!isImage(req.category) && !isVideo(req.category)) {
    return { success: false, error: 'unsupported-category' };
  }
  try {
    const dir = isVideo(req.category) ? await getVideoModelsDir() : await getImageModelsDir();
    await shell.openPath(dir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to open folder' };
  }
}

export async function handleModelsSetFolder(
  _event: IpcMainInvokeEvent,
  req: ModelsSetFolderRequest,
): Promise<ModelsSetFolderResponse> {
  if (!isImage(req.category)) {
    return { success: false, error: 'unsupported-category' };
  }
  try {
    await setImageModelsFolder(req.folderPath);
    const scan = await scanImageLibrary(); // rescan the new folder
    return { success: true, folder: scan.root };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to set folder' };
  }
}
