// Brand fonts IPC (video-10 import gap 10): hand the editor the local
// stylesheet URLs for the project's brand fonts. No brand, no module server,
// or no Google family is simply an empty list — never an error the user sees.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioBrandFontsGetRequest,
  StudioBrandFontsGetResponse,
} from '../../shared/ipc/types';
import { brandFontStylesheets } from '../services/brand-fonts';
import { ensureModuleServer, getModuleServerBaseUrl } from '../services/module-server';
import { resolveProjectBrand } from '../services/studio/project-brand';

export async function handleStudioBrandFontsGet(
  _event: IpcMainInvokeEvent,
  data: StudioBrandFontsGetRequest,
): Promise<StudioBrandFontsGetResponse> {
  try {
    const brand = await resolveProjectBrand(data.projectId, data.brandId);
    if (!brand) return { success: true, families: [], stylesheets: [] };
    // The module server starts on first use, and an editor that opens an
    // empty project has not used it yet — reading its address without this
    // returned nothing, and the fonts were never linked (live check, 2026-10-01).
    await ensureModuleServer();
    const baseUrl = getModuleServerBaseUrl();
    if (!baseUrl) return { success: true, families: [], stylesheets: [] };
    return { success: true, ...(await brandFontStylesheets(brand.fonts, baseUrl)) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resolve brand fonts' };
  }
}
