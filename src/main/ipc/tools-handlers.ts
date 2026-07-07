import path from 'path';
import fs from 'fs/promises';
import { dialog } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  FrameExtractRequest,
  FrameExtractResponse,
  FrameExtractCancelResponse,
  FrameSaveZipRequest,
  FrameSaveZipResponse,
  FrameSaveSingleRequest,
  FrameSaveSingleResponse,
} from '../../shared/ipc/types';
import { IPC } from '../../shared/ipc/channels';
import {
  extractFrames,
  cancelExtraction,
  createFrameZip,
} from '../services/frame-extractor';

export async function handleFrameExtract(
  event: IpcMainInvokeEvent,
  data: FrameExtractRequest
): Promise<FrameExtractResponse> {
  try {
    const result = await extractFrames(data, (progress) => {
      event.sender.send(IPC.TOOLS_FRAME_EXTRACT_PROGRESS, progress);
    });

    return {
      success: true,
      frames: result.frames,
      outputDir: result.outputDir,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFrameExtractCancel(): Promise<FrameExtractCancelResponse> {
  const cancelled = cancelExtraction();
  return { success: cancelled };
}

export async function handleFrameSaveZip(
  _event: IpcMainInvokeEvent,
  data: FrameSaveZipRequest
): Promise<FrameSaveZipResponse> {
  try {
    const defaultName = data.defaultName ?? 'frames.zip';
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    await createFrameZip(data.framePaths, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFrameSaveSingle(
  _event: IpcMainInvokeEvent,
  data: FrameSaveSingleRequest
): Promise<FrameSaveSingleResponse> {
  try {
    const ext = path.extname(data.framePath).replace('.', '');
    const defaultName = data.defaultName ?? path.basename(data.framePath);
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: `${ext.toUpperCase()} Image`, extensions: [ext] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Save cancelled' };
    }

    await fs.copyFile(data.framePath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
