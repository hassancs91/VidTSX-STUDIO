import type { IpcMainInvokeEvent } from 'electron';
import type {
  SystemInfoGetResponse,
  SystemModelsFolderOpenResponse,
  SystemRuntimeRemoveRequest,
  SystemRuntimeRemoveResponse,
  SystemRuntimesGetResponse,
} from '../../shared/ipc/types';
import { getSystemInfo } from '../services/system-info';
import { listSystemRuntimes, openAiModelsFolder, removeSystemRuntime } from '../services/system-runtimes';

export async function handleSystemInfoGet(
  _event: IpcMainInvokeEvent,
): Promise<SystemInfoGetResponse> {
  return getSystemInfo();
}

/** AI Models → Overview → Runtimes: the three single-binary runtimes with their size on disk. */
export async function handleSystemRuntimesGet(): Promise<SystemRuntimesGetResponse> {
  try {
    return { success: true, runtimes: await listSystemRuntimes() };
  } catch (err) {
    return { success: false, runtimes: [], error: err instanceof Error ? err.message : 'Failed to read runtimes' };
  }
}

export async function handleSystemRuntimeRemove(
  _event: IpcMainInvokeEvent,
  data: SystemRuntimeRemoveRequest,
): Promise<SystemRuntimeRemoveResponse> {
  try {
    await removeSystemRuntime(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove the runtime' };
  }
}

export async function handleSystemModelsFolderOpen(): Promise<SystemModelsFolderOpenResponse> {
  try {
    await openAiModelsFolder();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to open the models folder' };
  }
}
