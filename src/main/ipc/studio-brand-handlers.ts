import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioProjectBrandGetRequest,
  StudioProjectBrandGetResponse,
  StudioProjectBrandPromoteRequest,
  StudioProjectBrandPromoteResponse,
} from '../../shared/ipc/types';
import { promoteProjectBrand, readProjectBrand } from '../services/studio/project-brand';

// The Project settings panel's two brand calls (video-10 feedback item 7):
// show the project-local snapshot as a real choice, and promote it into the
// library. Setting `settings.brandId` stays a renderer document edit.

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function handleStudioProjectBrandGet(
  _event: IpcMainInvokeEvent,
  data: StudioProjectBrandGetRequest,
): Promise<StudioProjectBrandGetResponse> {
  try {
    return { success: true, brand: await readProjectBrand(data.projectId) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read the project brand') };
  }
}

export async function handleStudioProjectBrandPromote(
  _event: IpcMainInvokeEvent,
  data: StudioProjectBrandPromoteRequest,
): Promise<StudioProjectBrandPromoteResponse> {
  try {
    return { success: true, brand: await promoteProjectBrand(data.projectId) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save the brand to the library') };
  }
}
