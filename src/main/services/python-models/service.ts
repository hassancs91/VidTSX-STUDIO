/**
 * The one entry point for running a catalogue model (plan §7b). IPC handlers (Image
 * Studio, 3D Studio), the Studio agent tools, Flows nodes and Agents all call
 * `runPythonModel`; nothing else spawns Python. It owns the queue (one worker at a time
 * across every caller), the runtime/model preflight, the request build, failure
 * classification, and the provenance sidecar written next to every output.
 *
 *   preflightPythonModel(id)  → { ready } | { ready: false, reason, message, action }
 *   ensurePythonModelReady(id) → performs the action (runtime install + model download)
 *   startPythonModel(req)     → { requestId, promise }   (requestId first, for cancel)
 *   runPythonModel(req)       → awaits the above
 */
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { PythonModelPreflightIpc, PythonModelInstallAction } from '@shared/ipc/types/python-models';
import type { AiRuntimeVariant } from '@shared/ipc/types/ai-runtime';
import { pythonLocalEngine } from '../../../local-python-engine';
import type { PythonJobProgress, PythonRunResult } from '../../../local-python-engine/types';
import { logEngine } from '../../../logging/log-engine';
import { getPipelinesDir, getPythonModelsRoot, getPythonRequestsDir } from '../../utils/paths';
import {
  AI_RUNTIME_CATALOGUE,
  AI_RUNTIME_VERSION,
  formatRuntimeBytes,
  getAiRuntimeStatus,
  getInstalledAiRuntime,
  installAiRuntime,
  repairAiRuntime,
} from '../ai-runtime';
import { usageStore } from '../model-usage';
import { downloadPythonModel } from './download';
import { formatModelBytes, pythonModelById, type PythonModelProfile } from './registry';
import { buildPythonRequest, outputExtensionFor, validatePythonOptions } from './request-builder';
import { checkPythonModelFiles, runtimeSnapshot } from './status';

const log = logEngine.createLogger('PythonModels');

export interface PythonModelProgress {
  requestId: string;
  /** Worker stage ('starting' | 'ready' | 'import' | 'load-model' | 'process' | 'preprocess' | 'encode' | 'shape' | 'export'). */
  stage: string;
  pct?: number;
  message?: string;
}

export interface RunPythonModelRequest {
  modelId: string;
  input: { imagePath: string };
  /** Validated against the catalogue's zod shape. */
  options?: Record<string, unknown>;
  /** Folder the result lands in (created if missing). */
  outputDir: string;
  /** File name without extension; default `<input name>-<suffix>`. Collisions get `-2`, `-3`… */
  outputBaseName?: string;
  /** 3D: where the runner renders the preview PNG. */
  previewPath?: string;
  /** Recorded in the sidecar (e.g. { imageStudioId }). */
  source?: Record<string, unknown>;
  signal?: AbortSignal;
  onProgress?: (e: PythonModelProgress) => void;
}

export interface RunPythonModelResult {
  requestId: string;
  outputPath: string;
  /** `<output without extension>.json` with provenance. */
  sidecarPath: string;
  stats: Record<string, unknown>;
  seconds: number;
  device: string;
}

export class PythonModelNotReadyError extends Error {
  constructor(readonly preflight: Extract<PythonModelPreflightIpc, { ready: false }>) {
    super(preflight.message);
    this.name = 'PythonModelNotReadyError';
  }
}

// ─── Progress fan-out ───────────────────────────────────────────────────

const progressListeners = new Map<string, (e: PythonModelProgress) => void>();
let engineHooked = false;

function hookEngine(): void {
  if (engineHooked) return;
  engineHooked = true;
  pythonLocalEngine.onProgress = (p: PythonJobProgress) => {
    progressListeners.get(p.requestId)?.(p);
  };
}

// ─── Preflight ──────────────────────────────────────────────────────────

export const REMBG_DEFAULT_MODEL_ID = 'rembg-u2net';
export const REMBG_PREFERRED_MODEL_ID = 'rembg-isnet';

/**
 * Which background-removal model "Remove background" should run: ISNet when its
 * weights are on disk (sharper edges, plan §9.3), otherwise u2net — the default the
 * install dialog offers, and the companion TripoSR needs anyway. `root` is for tests.
 */
export async function preferredRembgModelId(root?: string): Promise<string> {
  const isnet = pythonModelById(REMBG_PREFERRED_MODEL_ID);
  if (!isnet) return REMBG_DEFAULT_MODEL_ID;
  const files = await checkPythonModelFiles(isnet, root);
  return files.every((f) => f.present) ? REMBG_PREFERRED_MODEL_ID : REMBG_DEFAULT_MODEL_ID;
}

function modelLabel(bytes: number): string {
  return `the model (${formatModelBytes(bytes)})`;
}

export async function preflightPythonModel(modelId: string): Promise<PythonModelPreflightIpc> {
  const profile = pythonModelById(modelId);
  if (!profile) throw new Error(`Unknown model: ${modelId}`);

  const [rt, files] = await Promise.all([runtimeSnapshot(), checkPythonModelFiles(profile)]);
  const bytesMissing = files.filter((f) => !f.present).reduce((n, f) => n + f.bytes, 0);
  const modelMissing = bytesMissing > 0;

  if (rt.state === 'installed' && !modelMissing) {
    return { ready: true, modelId, device: rt.cuda && profile.vramMb !== null ? 'gpu' : 'cpu', runtimeVariant: rt.variant ?? 'cpu' };
  }

  if (rt.state === 'installing') {
    return { ready: false, modelId, reason: 'runtime-installing', message: 'The AI runtime is still installing. Try again when the System tab says it is installed.' };
  }

  if (rt.state === 'installed') {
    // Only the model is missing.
    return {
      ready: false,
      modelId,
      reason: 'model-missing',
      message: `${profile.name} needs ${formatModelBytes(bytesMissing)} of model files downloaded first.`,
      action: { label: `Download ${modelLabel(bytesMissing)}`, kind: 'download-model', modelBytes: bytesMissing },
    };
  }

  // Runtime missing / update / broken: is it installable here?
  const status = await getAiRuntimeStatus();
  let variant = status.recommendedVariant;
  let rec = status.variants[variant];
  // The GPU build may fail a guard the CPU build passes (7.7 GB vs 1.2 GB of disk):
  // offer the CPU runtime instead of a dead end (Stage 5 disk-guard E2E).
  let fallbackNote = '';
  if (rec.issue && variant === 'cu126' && status.variants.cpu.issue === null) {
    fallbackNote = ` The GPU runtime cannot be installed here (${rec.issue.message.replace(/\.$/, '')}), so the smaller CPU runtime is offered instead.`;
    variant = 'cpu';
    rec = status.variants.cpu;
  }
  if (rec.issue) {
    const reason = rec.issue.code === 'path-too-long' ? 'path-too-long' : rec.issue.code === 'disk' ? 'disk' : rec.issue.code === 'unsupported-platform' ? 'unsupported-platform' : 'runtime-missing';
    return { ready: false, modelId, reason, message: rec.issue.message };
  }

  const runtimeLabel = `the AI runtime (${rec.sizeLabel})`;
  const action: PythonModelInstallAction = {
    kind: rt.state === 'broken' ? 'repair-runtime' : rt.state === 'update-available' ? 'update-runtime' : modelMissing ? 'install-runtime-and-model' : 'install-runtime',
    label:
      rt.state === 'broken'
        ? `Repair ${runtimeLabel}${modelMissing ? ` and download ${modelLabel(bytesMissing)}` : ''}`
        : rt.state === 'update-available'
          ? `Update ${runtimeLabel}${modelMissing ? ` and download ${modelLabel(bytesMissing)}` : ''}`
          : modelMissing
            ? `Download ${runtimeLabel} and ${modelLabel(bytesMissing)}`
            : `Download ${runtimeLabel}`,
    variant,
    runtimeBytes: rec.bytes,
    modelBytes: bytesMissing,
  };
  const reason = rt.state === 'broken' ? 'runtime-broken' : rt.state === 'update-available' ? 'runtime-update' : 'runtime-missing';
  const what = profile.category === '3d' ? '3D generation' : 'Background removal';
  const message =
    rt.state === 'broken'
      ? `${what} runs on your computer, but the AI runtime needs repairing.`
      : rt.state === 'update-available'
        ? `${what} runs on your computer. This version of the app needs AI runtime ${AI_RUNTIME_VERSION}.`
        : `${what} runs on your computer. Download the AI runtime (${rec.sizeLabel})${modelMissing ? ` and the model (${formatModelBytes(bytesMissing)})` : ''}?`;
  return { ready: false, modelId, reason, message: message + fallbackNote, action };
}

/**
 * Perform whatever the preflight asks for: runtime install / update / repair (awaited —
 * the System row shows its progress) and the model download. Resolves ready or throws.
 */
export async function ensurePythonModelReady(modelId: string, opts: { variant?: AiRuntimeVariant } = {}): Promise<void> {
  const pre = await preflightPythonModel(modelId);
  if (pre.ready) return;
  if (!pre.action) throw new PythonModelNotReadyError(pre);
  switch (pre.action.kind) {
    case 'install-runtime':
    case 'update-runtime':
    case 'install-runtime-and-model':
      await installAiRuntime({ variant: opts.variant ?? pre.action.variant });
      break;
    case 'repair-runtime':
      await repairAiRuntime(opts.variant ?? pre.action.variant);
      break;
    case 'download-model':
      break;
  }
  await downloadPythonModel(modelId);
  const again = await preflightPythonModel(modelId);
  if (!again.ready) throw new PythonModelNotReadyError(again);
}

// ─── Run ────────────────────────────────────────────────────────────────

async function reserveOutputPath(dir: string, base: string, ext: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${base}${ext}` : `${base}-${n}${ext}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
}

function defaultBaseName(profile: PythonModelProfile, imagePath: string): string {
  const stem = path.basename(imagePath, path.extname(imagePath));
  return profile.pipeline === 'rembg' ? `${stem}-nobg` : `${stem}-3d`;
}

export interface StartedPythonModel {
  requestId: string;
  outputPath: string;
  promise: Promise<RunPythonModelResult>;
}

/** Preflight + queue the run. Throws PythonModelNotReadyError before anything is queued. */
export async function startPythonModel(req: RunPythonModelRequest): Promise<StartedPythonModel> {
  const profile = pythonModelById(req.modelId);
  if (!profile) throw new Error(`Unknown model: ${req.modelId}`);
  const pre = await preflightPythonModel(req.modelId);
  if (!pre.ready) throw new PythonModelNotReadyError(pre);
  const options = validatePythonOptions(profile, req.options);
  const runtime = await getInstalledAiRuntime();
  if (!runtime) throw new PythonModelNotReadyError({ ready: false, modelId: req.modelId, reason: 'runtime-missing', message: 'The AI runtime is not installed.' });

  await fs.access(req.input.imagePath);
  const outputPath = await reserveOutputPath(req.outputDir, req.outputBaseName ?? defaultBaseName(profile, req.input.imagePath), outputExtensionFor(profile));
  const device: 'auto' | 'cpu' = options.device === 'cpu' || runtime.variant === 'cpu' ? 'cpu' : 'auto';
  const request = buildPythonRequest({
    profile,
    modelsRoot: getPythonModelsRoot(),
    imagePath: req.input.imagePath,
    outputPath,
    options,
    device,
    ...(req.previewPath ? { previewPath: req.previewPath } : {}),
  });

  hookEngine();
  const t0 = Date.now();
  const requestId = randomUUID();
  if (req.onProgress) progressListeners.set(requestId, req.onProgress);
  const { promise } = pythonLocalEngine.run(
    {
      python: runtime.python,
      runnerPath: path.join(getPipelinesDir(), profile.pipeline, 'runner.py'),
      request,
      requestDir: getPythonRequestsDir(),
      forceCpu: device === 'cpu' && runtime.variant === 'cu126',
      signal: req.signal,
    },
    requestId,
  );
  log.info('Run queued', { modelId: profile.id, requestId, device, outputPath });

  const settled = promise
    .then(async (result: PythonRunResult) => {
      const finalOutput = result.outputPath ?? outputPath;
      const sidecarPath = path.join(path.dirname(finalOutput), `${path.basename(finalOutput, path.extname(finalOutput))}.json`);
      const seconds = typeof result.stats.seconds === 'number' ? result.stats.seconds : (Date.now() - t0) / 1000;
      const sidecar = {
        schema: 1,
        modelId: profile.id,
        pipeline: profile.pipeline,
        toolId: profile.capability.toolId,
        runtime: { version: runtime.version, variant: runtime.variant, torch: runtime.torch },
        device: typeof result.stats.device === 'string' ? result.stats.device : device,
        options,
        input: { imagePath: req.input.imagePath },
        ...(req.source ? { source: req.source } : {}),
        stats: result.stats,
        seconds,
        wallMs: result.ms,
        createdAt: new Date().toISOString(),
      };
      await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8').catch((err) => log.warn('sidecar write failed', { sidecarPath, error: String(err) }));
      try {
        usageStore.recordUse(profile.category === '3d' ? '3d' : 'image', profile.id);
      } catch {
        /* usage is best-effort */
      }
      log.info('Run complete', { modelId: profile.id, requestId, seconds, ms: result.ms });
      return { requestId, outputPath: finalOutput, sidecarPath, stats: result.stats, seconds, device: sidecar.device };
    })
    .finally(() => {
      progressListeners.delete(requestId);
    });
  return { requestId, outputPath, promise: settled };
}

export async function runPythonModel(req: RunPythonModelRequest): Promise<RunPythonModelResult> {
  const started = await startPythonModel(req);
  return started.promise;
}

export function cancelPythonModelRun(requestId: string): boolean {
  return pythonLocalEngine.cancel(requestId);
}

/** Card copy helpers shared by dialogs. */
export function runtimeSizeLabel(variant: AiRuntimeVariant): string {
  return formatRuntimeBytes(AI_RUNTIME_CATALOGUE[variant].bytes);
}
