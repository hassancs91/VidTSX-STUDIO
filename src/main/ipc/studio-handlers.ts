import path from 'path';
import { spawn } from 'child_process';
import type { IpcMainInvokeEvent } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type {
  StudioFfprobeRequest,
  StudioFfprobeResponse,
  StudioProjectListResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioTsxSaveRequest,
  StudioTsxSaveResponse,
  StudioTsxGetPathRequest,
  StudioTsxGetPathResponse,
  StudioPresetListResponse,
  StudioPresetSaveRequest,
  StudioPresetSaveResponse,
  StudioPresetDeleteRequest,
  StudioPresetDeleteResponse,
  StudioBrandListResponse,
  StudioBrandSaveRequest,
  StudioBrandSaveResponse,
  StudioBrandDeleteRequest,
  StudioBrandDeleteResponse,
} from '../../shared/ipc/types';
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
} from '../services/studio-projects-db';
import {
  listPresets,
  savePreset,
  deletePreset,
} from '../services/studio-presets-db';
import {
  listBrands,
  saveBrand,
  deleteBrand,
} from '../services/studio-brands-db';
import { saveTsxFile, getTsxFilePath } from '../services/studio-tsx-files';
import { getRemotionBinariesDir } from '../utils/paths';

async function getFfprobePath(): Promise<string> {
  const { RenderInternals } = await import('@remotion/renderer');
  return RenderInternals.getExecutablePath({
    type: 'ffprobe',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });
}

function parseFps(rateStr: string): number {
  if (!rateStr || rateStr === '0/0') return 30;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    if (den > 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const parsed = parseFloat(rateStr);
  return isNaN(parsed) ? 30 : parsed;
}

interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    size?: string;
    filename?: string;
  };
}

export async function handleStudioFfprobe(
  _event: IpcMainInvokeEvent,
  data: StudioFfprobeRequest
): Promise<StudioFfprobeResponse> {
  try {
    const ffprobePath = await getFfprobePath();
    const { filePath } = data;

    const output = await new Promise<string>((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ];

      const proc = spawn(ffprobePath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
      });
    });

    const parsed: FfprobeOutput = JSON.parse(output);

    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');

    // Audio-only files (mp3, wav, …) have no video stream. Studio's audio
    // track only needs duration, so fall back to the first audio stream and
    // return placeholder dimensions (width/height = 0, fps = 30) — irrelevant
    // for an <Audio> clip but keeps the VideoMetadata shape intact.
    const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');
    if (!videoStream && !audioStream) {
      return { success: false, error: 'No video or audio stream found in file' };
    }

    const width = videoStream?.width ?? 0;
    const height = videoStream?.height ?? 0;
    const codec = (videoStream ?? audioStream)?.codec_name ?? 'unknown';

    const fps = videoStream
      ? parseFps(videoStream.r_frame_rate ?? '')
        || parseFps(videoStream.avg_frame_rate ?? '')
        || 30
      : 30;

    const durationInSeconds = parseFloat(parsed.format?.duration ?? '0');
    if (durationInSeconds <= 0) {
      return { success: false, error: 'Could not determine media duration' };
    }

    const durationInFrames = Math.ceil(durationInSeconds * fps);
    const fileSize = parseInt(parsed.format?.size ?? '0', 10);
    const fileName = path.basename(filePath);

    return {
      success: true,
      metadata: {
        durationInSeconds,
        durationInFrames,
        width,
        height,
        fps,
        codec,
        fileSize,
        fileName,
        filePath,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown ffprobe error';
    logEngine.error('Studio', 'ffprobe error', new Error(message));
    return { success: false, error: message };
  }
}

export async function handleStudioProjectList(
  _event: IpcMainInvokeEvent
): Promise<StudioProjectListResponse> {
  try {
    const projects = await listProjects();
    return { success: true, projects };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list projects';
    return { success: false, error };
  }
}

export async function handleStudioProjectSave(
  _event: IpcMainInvokeEvent,
  data: StudioProjectSaveRequest
): Promise<StudioProjectSaveResponse> {
  try {
    await saveProject(data.project);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save project';
    return { success: false, error };
  }
}

export async function handleStudioProjectLoad(
  _event: IpcMainInvokeEvent,
  data: StudioProjectLoadRequest
): Promise<StudioProjectLoadResponse> {
  try {
    const project = await loadProject(data.id);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true, project };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to load project';
    return { success: false, error };
  }
}

export async function handleStudioProjectDelete(
  _event: IpcMainInvokeEvent,
  data: StudioProjectDeleteRequest
): Promise<StudioProjectDeleteResponse> {
  try {
    await deleteProject(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete project';
    return { success: false, error };
  }
}

export async function handleStudioTsxSave(
  _event: IpcMainInvokeEvent,
  data: StudioTsxSaveRequest
): Promise<StudioTsxSaveResponse> {
  try {
    const filePath = await saveTsxFile(data.projectId, data.fileName, data.content);
    return { success: true, filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save TSX file';
    return { success: false, error };
  }
}

export async function handleStudioTsxGetPath(
  _event: IpcMainInvokeEvent,
  data: StudioTsxGetPathRequest
): Promise<StudioTsxGetPathResponse> {
  return { filePath: getTsxFilePath(data.projectId, data.fileName) };
}

export async function handleStudioPresetList(
  _event: IpcMainInvokeEvent
): Promise<StudioPresetListResponse> {
  try {
    const presets = await listPresets();
    return { success: true, presets };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list presets';
    return { success: false, error };
  }
}

export async function handleStudioPresetSave(
  _event: IpcMainInvokeEvent,
  data: StudioPresetSaveRequest
): Promise<StudioPresetSaveResponse> {
  try {
    await savePreset(data.preset);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save preset';
    return { success: false, error };
  }
}

export async function handleStudioPresetDelete(
  _event: IpcMainInvokeEvent,
  data: StudioPresetDeleteRequest
): Promise<StudioPresetDeleteResponse> {
  try {
    await deletePreset(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete preset';
    return { success: false, error };
  }
}

export async function handleStudioBrandList(
  _event: IpcMainInvokeEvent
): Promise<StudioBrandListResponse> {
  try {
    const brands = await listBrands();
    return { success: true, brands };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list brands';
    return { success: false, error };
  }
}

export async function handleStudioBrandSave(
  _event: IpcMainInvokeEvent,
  data: StudioBrandSaveRequest
): Promise<StudioBrandSaveResponse> {
  try {
    await saveBrand(data.brand);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save brand';
    return { success: false, error };
  }
}

export async function handleStudioBrandDelete(
  _event: IpcMainInvokeEvent,
  data: StudioBrandDeleteRequest
): Promise<StudioBrandDeleteResponse> {
  try {
    await deleteBrand(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete brand';
    return { success: false, error };
  }
}
