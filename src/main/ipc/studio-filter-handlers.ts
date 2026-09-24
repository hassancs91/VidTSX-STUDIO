// Filter packs (docs/studio/FILTER_PACKS_DESIGN.md "Delivery") — listing and
// preview-module resolution, the transition handlers' shape.
//
// One difference from transitions: a filter is a bundled `.js` with no
// imports, so nothing is transpiled. The gate (no imports, a default export,
// none of the banned globals, the size cap) runs at resolve, and the file is
// served exactly as the pack shipped it.

import { createHash } from 'crypto';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioFilterInfo,
  StudioFilterListResponse,
  StudioFilterModuleRequest,
  StudioFilterModuleResponse,
} from '../../shared/ipc/types';
import type { FilterItem } from '../../shared/studio/filter-pack';
import { listFilters, readFilterSource, resolveFilter } from '../services/studio/filter-packs';
import { ensureModuleServer, getModuleServerBaseUrl, storeRawModule } from '../services/module-server';

/** The manifest entry as the tabs see it — never the file path. */
function toInfo(item: FilterItem): StudioFilterInfo {
  return {
    kind: item.kind,
    name: item.name,
    packId: item.packId,
    packName: item.packName,
    category: item.category,
    animated: item.animated,
    defaultIntensity: item.defaultIntensity,
    parameters: item.parameters,
    presets: item.presets,
    heavy: item.heavy,
    version: item.version,
    ...(item.tier ? { tier: item.tier } : {}),
    ...(item.tagline ? { tagline: item.tagline } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(item.accent ? { accent: item.accent } : {}),
    ...(item.symbol ? { symbol: item.symbol } : {}),
  };
}

export async function handleStudioFilterList(): Promise<StudioFilterListResponse> {
  try {
    const items = await listFilters();
    return { success: true, filters: items.map(toInfo) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list filters' };
  }
}

export async function handleStudioFilterModule(
  _event: IpcMainInvokeEvent,
  data: StudioFilterModuleRequest,
): Promise<StudioFilterModuleResponse> {
  try {
    const item = await resolveFilter(data.kind);
    if (!item) {
      return { success: false, notInstalled: true, error: `Filter not installed: ${data.kind}` };
    }
    const read = await readFilterSource(item);
    if (!read.ok) return { success: false, error: read.error };

    await ensureModuleServer();
    if (!getModuleServerBaseUrl()) return { success: false, error: 'Module server failed to start' };

    // Keyed by content, so an updated pack file is a new URL and the preview
    // never gets a stale cached module.
    const key = `filter-${createHash('md5').update(read.source).digest('hex').slice(0, 12)}`;
    return { success: true, moduleUrl: storeRawModule(key, read.source) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to prepare filter' };
  }
}
