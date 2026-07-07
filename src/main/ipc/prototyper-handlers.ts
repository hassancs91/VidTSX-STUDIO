import { startRecording, stopRecording } from '../services/html-recorder';
import type {
  PrototyperRecordStartRequest,
  PrototyperRecordStartResponse,
  PrototyperRecordStopResponse,
} from '../../shared/ipc/types';

export async function handlePrototyperRecordStart(
  _event: Electron.IpcMainInvokeEvent,
  data: PrototyperRecordStartRequest
): Promise<PrototyperRecordStartResponse> {
  try {
    await startRecording(data.html, data.width, data.height, data.filePath);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to start recording';
    return { success: false, error };
  }
}

export async function handlePrototyperRecordStop(
  _event: Electron.IpcMainInvokeEvent
): Promise<PrototyperRecordStopResponse> {
  try {
    const filePath = await stopRecording();
    return { success: true, filePath: filePath || undefined };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to stop recording';
    return { success: false, error };
  }
}
