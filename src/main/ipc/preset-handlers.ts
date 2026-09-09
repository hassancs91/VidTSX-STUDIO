// Editing-preset IPC (V1 completion plan §2.5) — thin wrappers over the
// preset store, the brand-handler pattern. The first listing seeds the
// built-ins from resources/presets into the library (best-effort, logged).

import type { IpcMainInvokeEvent } from 'electron';
import type {
  LibraryPresetDeleteRequest,
  LibraryPresetDeleteResponse,
  LibraryPresetSaveRequest,
  LibraryPresetSaveResponse,
  LibraryPresetsGetResponse,
} from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import { getLibraryRoot } from '../services/library/library-paths';
import { ensureBuiltinPresets } from '../services/library/preset-builtins';
import {
  createPreset,
  deletePreset,
  listPresets,
  updatePreset,
} from '../services/library/preset-store';
import { getBuiltinPresetsDir } from '../utils/paths';

const log = logEngine.createLogger('PresetHandlers');

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Seed once per listing; a seeding problem must never fail the list. */
export async function seedBuiltinPresets(root: string): Promise<void> {
  try {
    await ensureBuiltinPresets(root, getBuiltinPresetsDir());
  } catch (err) {
    log.warn('Built-in preset seeding failed', { error: String(err) });
  }
}

export async function handleLibraryPresetsGet(): Promise<LibraryPresetsGetResponse> {
  try {
    const root = getLibraryRoot();
    await seedBuiltinPresets(root);
    return { success: true, presets: await listPresets(root) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to load presets') };
  }
}

export async function handleLibraryPresetSave(
  _event: IpcMainInvokeEvent,
  data: LibraryPresetSaveRequest,
): Promise<LibraryPresetSaveResponse> {
  try {
    const root = getLibraryRoot();
    const preset = data.presetId
      ? await updatePreset(root, data.presetId, data.input)
      : await createPreset(root, data.input);
    return { success: true, preset };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save the preset') };
  }
}

export async function handleLibraryPresetDelete(
  _event: IpcMainInvokeEvent,
  data: LibraryPresetDeleteRequest,
): Promise<LibraryPresetDeleteResponse> {
  try {
    await deletePreset(getLibraryRoot(), data.presetId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete the preset') };
  }
}
