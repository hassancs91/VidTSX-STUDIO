// The project's resolved cut style over IPC (plan T1, B2). The renderer cannot
// read cut-style.json or preset files, so the Transcript panel asks main for
// the same resolution the Auto Cut IPC, run_auto_cut and the editorial snap
// use — one resolver, four consumers.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioCutStyleResolveRequest,
  StudioCutStyleResolveResponse,
} from '../../shared/ipc/types';
import { resolveProjectCutStyle } from '../services/studio/cut-style-store';

export async function handleStudioCutStyleResolve(
  _event: IpcMainInvokeEvent,
  data: StudioCutStyleResolveRequest,
): Promise<StudioCutStyleResolveResponse> {
  try {
    const resolved = await resolveProjectCutStyle(data.projectId, {
      ...(data.settings ? { settings: data.settings } : {}),
    });
    return { success: true, resolved };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error && err.message ? err.message : 'Failed to resolve the cut style',
    };
  }
}
