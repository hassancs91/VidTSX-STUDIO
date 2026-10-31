import type { IpcMainInvokeEvent } from 'electron';
import type { StudioProjectHandoffRequest, StudioProjectHandoffResponse } from '../../shared/ipc/types';
import { isValidProjectId } from '../services/studio/studio-paths';
import { projectWriter } from '../services/studio/project-writer';

/** B5 fix round 1: a closing editor (or a quitting window) gives main the
 *  document it could not save yet. Returns at once — the write runs in the
 *  background (project-writer.ts), so the quit guard's ack is never late. */
export async function handleStudioProjectHandoff(
  _event: IpcMainInvokeEvent,
  data: StudioProjectHandoffRequest,
): Promise<StudioProjectHandoffResponse> {
  try {
    const id = data?.project?.id;
    if (typeof id !== 'string' || !isValidProjectId(id)) {
      return { success: false, error: 'A project with a valid id is required' };
    }
    projectWriter.handOff(data.project);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to hand off the project' };
  }
}
