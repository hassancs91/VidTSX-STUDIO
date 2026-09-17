import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import type { TranscriptResult } from '../../shared/ipc/types';
import { getRemotionBinariesDir } from '../utils/paths';
import { enqueueDownload } from './download-manager';
import { parseWhisperJson } from './whisper-output';

export interface WhisperModel {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  downloaded: boolean;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

// Model definitions — exact byte counts from the ggerganov/whisper.cpp LFS pointers (2026-09-05).
const MODEL_DEFINITIONS: Omit<WhisperModel, 'downloaded'>[] = [
  { id: 'tiny', name: 'Tiny', size: '75 MB', sizeBytes: 77_691_713 },
  { id: 'base', name: 'Base', size: '142 MB', sizeBytes: 147_951_465 },
  { id: 'small', name: 'Small', size: '466 MB', sizeBytes: 487_601_967 },
  { id: 'medium', name: 'Medium', size: '1.5 GB', sizeBytes: 1_533_763_059 },
  { id: 'large-v3', name: 'Large-v3', size: '3.1 GB', sizeBytes: 3_095_033_483 },
];

/**
 * sha256 of each ggml model file (from the Hugging Face LFS pointers of
 * ggerganov/whisper.cpp at `main`, 2026-09-05). The download engine verifies the file
 * before revealing it, so a truncated or tampered model never counts as installed.
 */
export const WHISPER_MODEL_SHA256: Record<string, string> = {
  tiny: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  base: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  small: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  medium: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  'large-v3': '64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2',
};

// whisper.cpp release info - using latest stable release from ggml-org
export const WHISPER_RELEASE_TAG = 'v1.8.3';
const WHISPER_BINARY_URL_WINDOWS = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}/whisper-bin-x64.zip`;
/** sha256 of whisper-bin-x64.zip for v1.8.3 (computed 2026-09-05, 3,968,674 bytes). */
const WHISPER_BINARY_SHA256_WINDOWS = 'd824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d';

// HuggingFace model URL pattern
export const MODEL_URL_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

export function getWhisperDir(): string {
  return path.join(app.getPath('userData'), 'whisper');
}

export function getModelsDir(): string {
  return path.join(getWhisperDir(), 'models');
}

export function getWhisperBinaryPath(): string {
  const whisperDir = getWhisperDir();
  // Windows uses .exe, macOS/Linux don't
  const binaryName = process.platform === 'win32' ? 'whisper.exe' : 'whisper';
  return path.join(whisperDir, binaryName);
}

export function isWhisperInstalled(): boolean {
  return existsSync(getWhisperBinaryPath());
}

export function getModelPath(modelId: string): string {
  return path.join(getModelsDir(), `ggml-${modelId}.bin`);
}

function isModelDownloaded(modelId: string): boolean {
  return existsSync(getModelPath(modelId));
}

export async function getAvailableModels(): Promise<WhisperModel[]> {
  // Ensure models directory exists
  await fs.mkdir(getModelsDir(), { recursive: true });

  return MODEL_DEFINITIONS.map((model) => ({
    ...model,
    downloaded: isModelDownloaded(model.id),
  }));
}

// Helper function to recursively find and copy all DLLs from a directory
async function copyAllDllsRecursive(
  sourceDir: string,
  destDir: string,
  skipDirs: string[] = []
): Promise<void> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
      await copyAllDllsRecursive(srcPath, destDir, skipDirs);
    } else if (entry.name.endsWith('.dll')) {
      const destPath = path.join(destDir, entry.name);
      // Only copy if not already exists (avoid overwriting)
      if (!existsSync(destPath)) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

export async function downloadWhisperBinary(onProgress?: ProgressCallback): Promise<void> {
  const whisperDir = getWhisperDir();
  await fs.mkdir(whisperDir, { recursive: true });

  if (process.platform !== 'win32') {
    throw new Error('Binary download currently only supports Windows. For macOS/Linux, please build whisper.cpp from source.');
  }

  const zipPath = path.join(whisperDir, 'whisper-bin-x64.zip');
  const binaryPath = getWhisperBinaryPath();

  try {
    // Download through the engine (resume, sha256 before extraction, zip extraction,
    // archive deleted after) — the same path every other binary and model uses.
    await enqueueDownload(
      {
        id: 'whisper-binary',
        url: WHISPER_BINARY_URL_WINDOWS,
        destPath: zipPath,
        sha256: WHISPER_BINARY_SHA256_WINDOWS,
        extraction: { format: 'zip', destDir: whisperDir, deleteArchive: true },
        metadata: { type: 'whisper-binary' },
      },
      onProgress
        ? (p) => onProgress({ percent: Math.max(0, p.percent), downloadedBytes: p.downloadedBytes, totalBytes: p.totalBytes })
        : undefined,
    );

    // The zip extracts to a Release/ subdirectory with whisper-cli.exe and DLLs
    const releaseDir = path.join(whisperDir, 'Release');
    const extractedCli = path.join(releaseDir, 'whisper-cli.exe');

    if (existsSync(extractedCli)) {
      // Copy whisper-cli.exe as whisper.exe
      await fs.copyFile(extractedCli, binaryPath);

      // Copy ALL DLLs from Release directory
      const releaseFiles = await fs.readdir(releaseDir);
      for (const file of releaseFiles) {
        if (file.endsWith('.dll')) {
          const srcPath = path.join(releaseDir, file);
          const destPath = path.join(whisperDir, file);
          await fs.copyFile(srcPath, destPath);
        }
      }

      // Clean up the Release directory
      await fs.rm(releaseDir, { recursive: true }).catch(() => {});
    } else {
      // Fallback: try looking for main.exe or whisper.exe directly
      const altExe1 = path.join(whisperDir, 'main.exe');
      const altExe2 = path.join(whisperDir, 'whisper.exe');
      if (existsSync(altExe1)) {
        await fs.rename(altExe1, binaryPath);
      } else if (!existsSync(altExe2)) {
        throw new Error('Could not find whisper executable in the downloaded archive');
      }
    }

    // Recursively search for any DLLs in other directories that might have been missed
    // Skip 'models' directory to avoid unnecessary scanning
    await copyAllDllsRecursive(whisperDir, whisperDir, ['models']);

    // Clean up the zip file
    await fs.unlink(zipPath).catch(() => {});
  } catch (err) {
    // Clean up on error
    await fs.unlink(zipPath).catch(() => {});
    throw err;
  }
}

export async function deleteModel(modelId: string): Promise<void> {
  const modelPath = getModelPath(modelId);
  const partPath = `${modelPath}.part`;

  const finalExists = existsSync(modelPath);
  const partExists = existsSync(partPath);

  if (!finalExists && !partExists) {
    throw new Error(`Model ${modelId} is not downloaded`);
  }

  if (finalExists) await fs.unlink(modelPath);
  if (partExists) await fs.unlink(partPath);
}

// Module state for active transcription process
let activeTranscription: ChildProcess | null = null;
let activeTempAudioPath: string | null = null;

// Transcription options
export interface TranscribeOptions {
  inputPath: string;
  modelId: string;
  language?: string;
  /** whisper.cpp `--prompt`: an initial prompt that primes spellings (W4
   *  vocabulary feed). Keep it short — it shares the first decoding window. */
  prompt?: string;
}

// Progress callback types
export type TranscribePhase = 'extracting' | 'transcribing' | 'parsing';
export type TranscribeProgressCallback = (
  phase: TranscribePhase,
  percent: number,
  message?: string
) => void;

// Get temp directory for extracted audio
function getTempDir(): string {
  return path.join(app.getPath('temp'), 'vidtsx-transcription');
}

// Extract audio from video using Remotion's FFmpeg
async function extractAudio(
  inputPath: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const tempDir = getTempDir();
  await fs.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `audio-${Date.now()}.wav`);

  // Use @remotion/renderer to get ffmpeg path
  const { RenderInternals } = await import('@remotion/renderer');
  const ffmpegExe = RenderInternals.getExecutablePath({
    type: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: getRemotionBinariesDir(),
  });

  return new Promise((resolve, reject) => {
    // ffmpeg -i input.mp4 -ar 16000 -ac 1 -f wav output.wav
    const proc = spawn(
      ffmpegExe,
      [
        '-i',
        inputPath,
        '-ar',
        '16000', // 16kHz sample rate (whisper requirement)
        '-ac',
        '1', // mono
        '-f',
        'wav',
        '-y', // overwrite
        outputPath,
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stderr = '';
    let duration = 0;

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();

      // Parse duration from ffmpeg output
      const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
      if (durationMatch && duration === 0) {
        const [, h, m, s] = durationMatch;
        duration = parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
      }

      // Parse progress
      const timeMatch = data.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && duration > 0) {
        const [, h, m, s] = timeMatch;
        const current = parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
        onProgress(Math.min(99, Math.round((current / duration) * 100)));
      }
    });

    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        onProgress(100);
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

// Main transcribe function
export async function transcribe(
  options: TranscribeOptions,
  onProgress: TranscribeProgressCallback
): Promise<TranscriptResult> {
  const { inputPath, modelId, language, prompt } = options;

  // Validate inputs
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const modelPath = getModelPath(modelId);
  if (!existsSync(modelPath)) {
    throw new Error(`Model not downloaded: ${modelId}`);
  }

  const binaryPath = getWhisperBinaryPath();
  if (!existsSync(binaryPath)) {
    throw new Error('Whisper binary not installed');
  }

  // Validate DLLs exist (Windows only)
  if (process.platform === 'win32') {
    const whisperDir = getWhisperDir();
    const requiredDlls = ['whisper.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cpu.dll'];
    const missingDlls = requiredDlls.filter(
      (dll) => !existsSync(path.join(whisperDir, dll))
    );
    if (missingDlls.length > 0) {
      throw new Error(
        `Missing required DLLs: ${missingDlls.join(', ')}. Please reinstall Whisper from Settings.`
      );
    }
  }

  // Phase 1: Extract audio (for video files)
  onProgress('extracting', 0, 'Extracting audio...');

  const ext = path.extname(inputPath).toLowerCase();
  const isWav = ext === '.wav';

  let audioPath: string;
  if (isWav) {
    // Already a WAV file, use directly
    audioPath = inputPath;
    onProgress('extracting', 100, 'Using input audio');
  } else {
    // Extract audio from video or convert audio format
    audioPath = await extractAudio(inputPath, (percent) => {
      onProgress('extracting', percent, 'Extracting audio...');
    });
    activeTempAudioPath = audioPath;
  }

  // Phase 2: Run whisper transcription
  onProgress('transcribing', 0, 'Starting transcription...');

  const tempDir = getTempDir();
  await fs.mkdir(tempDir, { recursive: true });
  const outputBase = path.join(tempDir, `transcript-${Date.now()}`);

  // -oj/-ojf output full JSON — the full variant carries per-token timestamps
  // and probabilities, which parseWhisperJson merges into measured per-word
  // timings (verified against the v1.8.3 binary the app downloads).
  // --print-progress enables progress output to stderr.
  const args = ['-m', modelPath, '-f', audioPath, '-of', outputBase, '-oj', '-ojf', '--print-progress'];

  if (language && language !== 'auto') {
    args.push('-l', language);
  }
  if (prompt) {
    args.push('--prompt', prompt);
  }

  await new Promise<void>((resolve, reject) => {
    activeTranscription = spawn(binaryPath, args, {
      cwd: getWhisperDir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    activeTranscription.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();

      // Parse whisper progress output (varies by version)
      // whisper.cpp with --print-progress prints: "whisper_full_with_state: progress = 45%"
      const progressMatch = output.match(/progress\s*=\s*(\d+)/i);
      if (progressMatch) {
        onProgress('transcribing', parseInt(progressMatch[1]), 'Transcribing...');
      }
    });

    activeTranscription.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();

      // whisper.cpp --print-progress outputs to stderr: "whisper_full_with_state: progress = 45%"
      const progressMatch = data.toString().match(/progress\s*=\s*(\d+)/i);
      if (progressMatch) {
        onProgress('transcribing', parseInt(progressMatch[1]), 'Transcribing...');
      }
    });

    activeTranscription.on('close', (code) => {
      activeTranscription = null;

      if (code === 0) {
        resolve();
      } else {
        let errorMsg = `Whisper exited with code ${code}: ${stderr.slice(-500)}`;
        // Windows STATUS_DLL_NOT_FOUND = 0xC0000135 = 3221225781 (or -1073741515 as signed)
        if (code === 3221225781 || code === -1073741515) {
          errorMsg =
            'Whisper failed to start: Missing DLL dependency. Please install Visual C++ Redistributable 2015-2022 from: https://aka.ms/vs/17/release/vc_redist.x64.exe - then restart the app and try again.';
        }
        reject(new Error(errorMsg));
      }
    });

    activeTranscription.on('error', (err) => {
      activeTranscription = null;
      reject(new Error(`Failed to start Whisper: ${err.message}`));
    });
  });

  // Phase 3: Parse output
  onProgress('parsing', 50, 'Processing results...');

  const jsonOutputPath = `${outputBase}.json`;
  if (!existsSync(jsonOutputPath)) {
    throw new Error('Whisper did not produce output file');
  }

  const result = parseWhisperJson(readFileSync(jsonOutputPath, 'utf-8'), language);

  // Cleanup temp files
  activeTempAudioPath = null;
  try {
    if (audioPath !== inputPath) {
      await fs.unlink(audioPath);
    }
    await fs.unlink(jsonOutputPath);
  } catch {
    // Ignore cleanup errors
  }

  onProgress('parsing', 100, 'Complete');
  return result;
}

// Cancel active transcription
export function cancelTranscription(): boolean {
  if (activeTranscription) {
    activeTranscription.kill('SIGTERM');
    activeTranscription = null;
    // Clean up temp audio file
    if (activeTempAudioPath) {
      fs.unlink(activeTempAudioPath).catch(() => {});
      activeTempAudioPath = null;
    }
    return true;
  }
  return false;
}

export const whisperService = {
  getWhisperDir,
  getModelsDir,
  getWhisperBinaryPath,
  isWhisperInstalled,
  getModelPath,
  getAvailableModels,
  downloadWhisperBinary,
  deleteModel,
  transcribe,
  cancelTranscription,
};
