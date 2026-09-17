import { spawn, ChildProcess } from 'child_process';
import type {
  ResolvedVideoModel,
  VideoGenerationProgress,
  VideoGenerationRequest,
} from './types';
import { adaptPrompt } from './prompt-adapter';
import { classifySdCliFailure, SdCliError } from '../local-image-engine/sd-cli-failure';

export interface VideoCliRunOptions {
  sdCliBinaryPath: string;
  resolved: ResolvedVideoModel;
  request: VideoGenerationRequest;
  outputPath: string;
  requestId: string;
  onProgress: (progress: VideoGenerationProgress) => void;
}

export interface VideoCliRunResult {
  seed: number;
  outputPath: string;
}

let activeProcess: ChildProcess | null = null;

/**
 * Build sd-cli `vid_gen` args from a fully-resolved video model and request.
 * Pure — exported for unit tests. Prompts run through the per-family adapter
 * (LingBot JSON captions, Wan/LTX default negatives). Companion flags map from
 * `resolved.companionPaths` (see sd.cpp docs/wan.md, ltx2.md, lingbot_video.md).
 */
export function buildVideoArgs(
  resolved: ResolvedVideoModel,
  request: VideoGenerationRequest,
  outputPath: string,
): string[] {
  const { defaults, family } = resolved;
  const adapted = adaptPrompt(family, request.prompt, request.negativePrompt);

  const args: string[] = [
    '-M', 'vid_gen',
    '--diffusion-model', resolved.modelFilePath,
    '-p', adapted.prompt,
    '-W', String(request.width ?? defaults.width),
    '-H', String(request.height ?? defaults.height),
    '--steps', String(request.steps ?? defaults.steps),
    '--cfg-scale', String(request.cfgScale ?? defaults.cfgScale),
    '--sampling-method', request.sampler ?? defaults.sampler,
    '--video-frames', String(request.frames ?? defaults.frames),
    '--fps', String(request.fps ?? defaults.fps),
    '-o', outputPath,
    '--diffusion-fa',
    '-v',
  ];

  if (adapted.negativePrompt) {
    args.push('-n', adapted.negativePrompt);
  }

  if (request.seed !== undefined && request.seed !== -1) {
    args.push('-s', String(request.seed));
  }

  if (request.initImagePath) {
    args.push('-i', request.initImagePath);
  }

  if (request.offloadToCpu) {
    args.push('--offload-to-cpu');
  }
  if (request.clipOnCpu) {
    args.push('--clip-on-cpu');
  }
  if (request.vaeOnCpu) {
    args.push('--vae-on-cpu');
  }

  // Wan is a flow model — the sd.cpp examples pin flow-shift to 3.0.
  if (family === 'wan21' || family === 'wan22') {
    args.push('--flow-shift', '3.0');
  }

  const { companionPaths } = resolved;
  if (companionPaths.t5xxl) args.push('--t5xxl', companionPaths.t5xxl);
  if (companionPaths.llm) args.push('--llm', companionPaths.llm);
  if (companionPaths.vae) args.push('--vae', companionPaths.vae);
  if (companionPaths.audioVae) args.push('--audio-vae', companionPaths.audioVae);
  if (companionPaths.embeddings) args.push('--embeddings-connectors', companionPaths.embeddings);
  if (companionPaths.clipVision) args.push('--clip_vision', companionPaths.clipVision);

  return args;
}

/**
 * Parse sampling progress from sd-cli output. sd.cpp draws the same bar for
 * tensor loading (`|####| 76/242 - 2.36GB/s`) and for sampling
 * (`|====| 5/20 - 3.20s/it`), and only the latter is progress a job card should
 * fill with — the rate unit decides. Pure; exported for unit tests.
 */
export function parseProgress(line: string, requestId: string): VideoGenerationProgress | null {
  const stepMatch =
    line.match(/(\d+)\s*\/\s*(\d+)\s*-\s*[\d.]+\s*(?:s\/it|it\/s)/i) ?? line.match(/\bstep\s+(\d+)\s*\/\s*(\d+)/i);
  if (!stepMatch) return null;
  const step = parseInt(stepMatch[1], 10);
  const totalSteps = parseInt(stepMatch[2], 10);
  if (totalSteps <= 0) return null;
  return { requestId, step, totalSteps, percent: Math.round((step / totalSteps) * 100) };
}

function parseSeed(output: string): number {
  const seedMatch = output.match(/seed[:\s]+(\d+)/i);
  return seedMatch ? parseInt(seedMatch[1], 10) : -1;
}

export function runVideoCli(options: VideoCliRunOptions): Promise<VideoCliRunResult> {
  return new Promise((resolve, reject) => {
    const args = buildVideoArgs(options.resolved, options.request, options.outputPath);
    let fullOutput = '';

    const proc = spawn(options.sdCliBinaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    activeProcess = proc;

    const onData = (data: Buffer) => {
      const line = data.toString();
      fullOutput += line;
      const progress = parseProgress(line, options.requestId);
      if (progress) options.onProgress(progress);
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);

    proc.on('error', (err) => {
      activeProcess = null;
      const raw = `sd-cli process error: ${err.message}`;
      reject(new SdCliError(classifySdCliFailure(null, raw), raw));
    });

    proc.on('close', (code) => {
      activeProcess = null;

      if (code === 0) {
        resolve({ seed: parseSeed(fullOutput), outputPath: options.outputPath });
      } else {
        const raw = `sd-cli exited with code ${code}: ${fullOutput.slice(-2000)}`;
        reject(new SdCliError(classifySdCliFailure(code, fullOutput), raw));
      }
    });
  });
}

export function killActiveVideo(): boolean {
  if (!activeProcess) return false;

  const pid = activeProcess.pid;
  if (!pid) {
    activeProcess = null;
    return false;
  }

  if (process.platform === 'win32') {
    // On Windows, SIGTERM doesn't work reliably — use taskkill
    spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { windowsHide: true });
  } else {
    activeProcess.kill('SIGTERM');
  }

  activeProcess = null;
  return true;
}

export function isVideoRunning(): boolean {
  return activeProcess !== null;
}
