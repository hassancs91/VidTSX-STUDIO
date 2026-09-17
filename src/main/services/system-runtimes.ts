import fs from 'fs/promises';
import path from 'path';
import { shell } from 'electron';
import type { SystemRuntimeId, SystemRuntimeIpc } from '../../shared/ipc/types';
import { getSdCliBinaryPath, getSdCliUserDir, isSdCliInstalled } from './sdimage-models';
import { isSdCliInstalling, SDCLI_RELEASE_TAG } from './sdcli-install';
import { getWhisperDir, isWhisperInstalled, WHISPER_RELEASE_TAG } from './whisper';
import {
  FFMPEG_FULL_CATALOGUE,
  getFfmpegFullBinary,
  getFfmpegFullDir,
  isFfmpegFullDownloading,
  isFfmpegFullInstalling,
} from './studio/ffmpeg-full';
import { getAiModelsFolder } from './settings';

/** Whisper keeps its models next to the binary; Remove and the size leave that folder alone. */
const WHISPER_MODELS_DIR_NAME = 'models';

/** Bytes under a folder (recursive); 0 when it does not exist. `skip` names top-level entries to leave out. */
export async function dirSizeBytes(dir: string, skip: readonly string[] = []): Promise<number> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSizeBytes(full);
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        // a file removed mid-walk
      }
    }
  }
  return total;
}

/**
 * The Runtimes table of AI Models → Overview (docs/ai-models-redesign.md
 * §3.1): the three single-binary runtimes the app downloads on first use.
 * The AI runtime (Python + PyTorch) reports through its own status IPC.
 */
export async function listSystemRuntimes(): Promise<SystemRuntimeIpc[]> {
  const whisperDir = getWhisperDir();
  const sdCliDir = getSdCliUserDir();
  const ffmpegDir = getFfmpegFullDir();
  // Dev builds may run the drop-in under resources/binaries; only a user-data install is ours to remove.
  const sdCliInUserDir = path.resolve(path.dirname(getSdCliBinaryPath())) === path.resolve(sdCliDir);
  const [whisperBytes, sdCliBytes, ffmpegBytes, ffmpegBinary] = await Promise.all([
    dirSizeBytes(whisperDir, [WHISPER_MODELS_DIR_NAME]),
    dirSizeBytes(sdCliDir),
    dirSizeBytes(ffmpegDir),
    getFfmpegFullBinary(),
  ]);
  return [
    {
      id: 'whisper-cpp',
      name: 'whisper.cpp',
      powers: 'Transcription · captions · Studio scripts',
      installed: isWhisperInstalled(),
      installing: false,
      release: WHISPER_RELEASE_TAG,
      downloadLabel: '',
      sizeOnDiskBytes: whisperBytes,
      dir: whisperDir,
      removable: true,
    },
    {
      id: 'sd-cli',
      name: 'sd-cli',
      powers: 'Local image and video generation',
      installed: isSdCliInstalled(),
      installing: isSdCliInstalling(),
      release: SDCLI_RELEASE_TAG,
      downloadLabel: '~36 MB',
      sizeOnDiskBytes: sdCliBytes,
      dir: sdCliInUserDir ? sdCliDir : path.dirname(getSdCliBinaryPath()),
      removable: sdCliInUserDir,
    },
    {
      id: 'ffmpeg-full',
      name: 'GPU encoder (ffmpeg)',
      powers: 'Studio preview proxies on the graphics card',
      installed: ffmpegBinary !== null,
      installing: isFfmpegFullInstalling() || isFfmpegFullDownloading(),
      // The catalogue string carries the autobuild date too; the row shows the build tag.
      release: FFMPEG_FULL_CATALOGUE.version.split(' ')[0],
      downloadLabel: `~${Math.round(FFMPEG_FULL_CATALOGUE.bytes / 1_048_576)} MB`,
      sizeOnDiskBytes: ffmpegBytes,
      dir: ffmpegDir,
      removable: true,
    },
  ];
}

/**
 * Delete a runtime's files. Whisper's models stay (they live inside its
 * folder); the other two folders hold nothing but the binaries. Refused
 * while an install is in flight.
 */
export async function removeSystemRuntime(id: SystemRuntimeId): Promise<void> {
  switch (id) {
    case 'whisper-cpp': {
      const dir = getWhisperDir();
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.name === WHISPER_MODELS_DIR_NAME) continue;
        await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
      }
      return;
    }
    case 'sd-cli':
      if (isSdCliInstalling()) throw new Error('sd-cli is installing — wait for it to finish.');
      await fs.rm(getSdCliUserDir(), { recursive: true, force: true });
      return;
    case 'ffmpeg-full':
      if (isFfmpegFullInstalling() || isFfmpegFullDownloading()) {
        throw new Error('ffmpeg is downloading — wait for it to finish.');
      }
      await fs.rm(getFfmpegFullDir(), { recursive: true, force: true });
      return;
  }
}

/** Reveal the AI models root folder (the Storage panel's Open). */
export async function openAiModelsFolder(): Promise<void> {
  const dir = await getAiModelsFolder();
  await fs.mkdir(dir, { recursive: true });
  const result = await shell.openPath(dir);
  if (result) throw new Error(result);
}
