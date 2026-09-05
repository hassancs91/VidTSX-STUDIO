/**
 * Pure helpers for 3D Studio: quality options capped by VRAM (plan §5 step 3: 256 on
 * ≤ 4 GB, 512 only ≥ 8 GB — Stage 0 measured 1024 on 4 GB burning 5 min before OOM),
 * the IPC request builder, stage labels and an overall-percent estimate. Unit-tested.
 */
import type { AiRuntimeVariant, Sd3dGenerateRequest, Sd3dStage } from '../../../shared/ipc/types';
import type { GenerationSettings, Quality, QualityOption } from '../types';

/** VRAM needed for the 512³ marching-cubes grid on the GPU (measured floor ×2 headroom). */
export const QUALITY_512_MIN_VRAM_GB = 8;

export function qualityOptions(vramGB: number | null, runtimeVariant: AiRuntimeVariant | null): QualityOption[] {
  const cpu = runtimeVariant === 'cpu';
  const gpuOk = vramGB !== null && vramGB >= QUALITY_512_MIN_VRAM_GB;
  const enabled512 = cpu || gpuOk;
  let reason: string | undefined;
  if (!enabled512) {
    reason =
      vramGB === null
        ? `512³ needs a GPU with ${QUALITY_512_MIN_VRAM_GB} GB of VRAM (or the CPU runtime)`
        : `Your GPU has ${Math.round(vramGB * 10) / 10} GB; 512³ needs ${QUALITY_512_MIN_VRAM_GB} GB (or the CPU runtime)`;
  }
  return [
    { value: '256', label: 'Standard (256³)', enabled: true },
    { value: '512', label: cpu ? 'High (512³, slower)' : 'High (512³)', enabled: enabled512, reason },
  ];
}

/** Clamp a stored/requested quality to what this machine may run. */
export function clampQuality(wanted: Quality, options: QualityOption[]): Quality {
  const opt = options.find((o) => o.value === wanted);
  return opt && opt.enabled ? wanted : '256';
}

export function buildSd3dRequest(settings: GenerationSettings, install?: { variant?: AiRuntimeVariant }): Sd3dGenerateRequest {
  return {
    source: settings.source,
    quality: settings.quality,
    removeBackground: settings.removeBackground,
    ...(settings.seed !== null ? { seed: settings.seed } : {}),
    ...(settings.device === 'cpu' ? { device: 'cpu' } : {}),
    ...(install ? { installIfMissing: true, ...(install.variant ? { runtimeVariant: install.variant } : {}) } : {}),
  };
}

export function toFileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

export const STAGE_LABELS: Record<Sd3dStage, string> = {
  'installing-runtime': 'Installing the AI runtime',
  'downloading-model': 'Downloading the model (1.7 GB)',
  'preparing-runtime': 'Preparing runtime',
  'loading-model': 'Loading model',
  'preparing-image': 'Preparing image',
  shape: 'Shape',
  export: 'Export',
  saving: 'Saving',
};

/**
 * Overall progress estimate from the stage and the worker's in-stage percent, using
 * the Stage 0 GPU stage timings (load 14 s, preprocess 2 s, encode 3 s, shape 5 s, export
 * < 1 s). Install stages report their own download percent.
 */
export function overallPercent(stage: Sd3dStage, pct: number | undefined): number {
  const ranges: Partial<Record<Sd3dStage, [number, number]>> = {
    'preparing-runtime': [0, 10],
    'loading-model': [10, 55],
    'preparing-image': [55, 62],
    shape: [62, 95],
    export: [95, 99],
    saving: [99, 100],
  };
  const r = ranges[stage];
  if (!r) return pct ?? 0;
  const inner = pct === undefined ? 0 : Math.max(0, Math.min(100, pct)) / 100;
  return Math.round(r[0] + (r[1] - r[0]) * inner);
}

/** A fresh random seed in the range the runner accepts. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}
