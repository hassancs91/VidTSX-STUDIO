import type { IpcMainInvokeEvent } from 'electron';
import type { SystemInfoGetResponse } from '../../shared/ipc/types';
import { getSystemInfo } from '../services/system-info';

export async function handleSystemInfoGet(
  _event: IpcMainInvokeEvent,
): Promise<SystemInfoGetResponse> {
  return getSystemInfo();
}
