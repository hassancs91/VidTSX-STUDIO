import { spawn, ChildProcess } from 'child_process';
import type {
  SdGenerationRequest,
  SdGenerationProgress,
  ResolvedSdModel,
} from './types';

export interface SdCliRunOptions {
  sdCliBinaryPath: string;
  resolved: ResolvedSdModel;
  request: SdGenerationRequest;
  outputPath: string;
  requestId: string;
  onProgress: (progress: SdGenerationProgress) => void;
}

export interface SdCliRunResult {
  seed: number;
  outputPath: string;
}

let activeProcess: ChildProcess | null = null;

/**
 * Build sd-cli args from a fully-resolved model (absolute model + companion
 * paths) and the request. Pure — exported for unit tests. Companion flags come
 * straight from `resolved.companionPaths`; an all-in-one checkpoint uses `-m`
 * with no companion flags.
 */
export function buildArgs(
  resolved: ResolvedSdModel,
  request: SdGenerationRequest,
  outputPath: string,
): string[] {
  const { defaults } = resolved;
  const useDiffusionModel = Boolean(resolved.useDiffusionModelFlag) && !resolved.allInOne;

  const args: string[] = [
    useDiffusionModel ? '--diffusion-model' : '-m', resolved.modelFilePath,
    '-p', request.prompt,
    '-W', String(request.width ?? defaults.width),
    '-H', String(request.height ?? defaults.height),
    '--steps', String(request.steps ?? defaults.steps),
    '--cfg-scale', String(request.cfgScale ?? defaults.cfgScale),
    '--sampling-method', request.sampler ?? defaults.sampler,
    '-o', outputPath,
    '-v',
  ];

  if (request.negativePrompt) {
    args.push('-n', request.negativePrompt);
  }

  if (request.seed !== undefined && request.seed !== -1) {
    args.push('-s', String(request.seed));
  }

  if (request.operation === 'img2img' && request.sourceImagePath) {
    args.push('-i', request.sourceImagePath);
    args.push('--strength', String(request.strength ?? 0.75));
  }

  if (request.schedule) {
    args.push('--schedule', request.schedule);
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

  if (request.threads !== undefined && request.threads > 0) {
    args.push('-t', String(request.threads));
  }

  if (request.vaePath) {
    args.push('--vae', request.vaePath);
  }

  if (request.loraPath) {
    args.push('--lora-model-dir', request.loraPath);
  }

  if (request.loraMultiplier !== undefined) {
    args.push('--lora-multiplier', String(request.loraMultiplier));
  }

  if (request.batchCount !== undefined && request.batchCount > 1) {
    args.push('-b', String(request.batchCount));
  }

  // Resolved companion files (absolute paths). All-in-one checkpoints bundle
  // their encoders/VAE, so no companion flags are added for them.
  if (!resolved.allInOne) {
    const { companionPaths } = resolved;
    if (companionPaths.llm) {
      args.push('--llm', companionPaths.llm);
    }
    if (companionPaths.clipL) {
      args.push('--clip_l', companionPaths.clipL);
    }
    if (companionPaths.t5xxl) {
      args.push('--t5xxl', companionPaths.t5xxl);
    }
    if (companionPaths.vae && !request.vaePath) {
      args.push('--vae', companionPaths.vae);
    }
  }

  return args;
}

/**
 * Parse progress from sd-cli stdout/stderr output.
 * Looks for patterns like "step 5/20", "[5/20]", "5/20", or "25%"
 */
function parseProgress(
  line: string,
  requestId: string,
): SdGenerationProgress | null {
  // Match step patterns: "step 5/20", "[5/20]", "5/20"
  const stepMatch = line.match(/(?:step\s+)?(\d+)\s*[/]\s*(\d+)/i);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    const totalSteps = parseInt(stepMatch[2], 10);
    return {
      requestId,
      step,
      totalSteps,
      percent: Math.round((step / totalSteps) * 100),
    };
  }

  // Match percentage pattern: "25%" or "25.0%"
  const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const percent = Math.round(parseFloat(percentMatch[1]));
    return {
      requestId,
      step: 0,
      totalSteps: 0,
      percent,
    };
  }

  return null;
}

/**
 * Parse the seed from sd-cli output.
 * Looks for patterns like "seed: 12345" or "Seed: 12345"
 */
function parseSeed(output: string): number {
  const seedMatch = output.match(/seed[:\s]+(\d+)/i);
  if (seedMatch) {
    return parseInt(seedMatch[1], 10);
  }
  return -1;
}

export function runSdCli(options: SdCliRunOptions): Promise<SdCliRunResult> {
  return new Promise((resolve, reject) => {
    const args = buildArgs(options.resolved, options.request, options.outputPath);
    let fullOutput = '';

    const proc = spawn(options.sdCliBinaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    activeProcess = proc;

    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      fullOutput += line;

      const progress = parseProgress(line, options.requestId);
      if (progress) {
        options.onProgress(progress);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString();
      fullOutput += line;

      const progress = parseProgress(line, options.requestId);
      if (progress) {
        options.onProgress(progress);
      }
    });

    proc.on('error', (err) => {
      activeProcess = null;
      reject(new Error(`sd-cli process error: ${err.message}`));
    });

    proc.on('close', (code) => {
      activeProcess = null;

      if (code === 0) {
        resolve({
          seed: parseSeed(fullOutput),
          outputPath: options.outputPath,
        });
      } else {
        reject(new Error(`sd-cli exited with code ${code}: ${fullOutput.slice(-500)}`));
      }
    });
  });
}

export function killActive(): boolean {
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

export function isRunning(): boolean {
  return activeProcess !== null;
}
