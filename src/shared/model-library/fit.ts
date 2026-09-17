/**
 * Pure VRAM/RAM fit evaluator (category-agnostic, electron-free).
 *
 * Compares a model's estimated memory footprint against the detected hardware
 * and returns an actionable verdict. stable-diffusion.cpp holds model weights in
 * VRAM unless offloaded to CPU/RAM (`--offload-to-cpu` etc.), so "over VRAM" is a
 * *warning* (offload to RAM, slower) rather than a hard stop — only "won't fit in
 * RAM either" is unrunnable.
 *
 * Injectable by construction: hardware + requirement in, verdict out. No fs,
 * electron, or global state — unit-tested in isolation.
 */

/** Fit verdict. `unknown` = VRAM couldn't be detected (never scare the user). */
export type FitLevel = 'ok' | 'tight' | 'offload' | 'wont-fit' | 'unknown';

export interface FitRequirement {
  /**
   * Explicit VRAM floor in GB (from the profile `requirements` or the family
   * preset). Optional — models without one rely purely on the size estimate.
   */
  minVramGB?: number;
  /** Model file size in bytes — drives the size-based VRAM estimate. */
  sizeBytes: number;
}

export interface FitHardware {
  /** Total GPU VRAM in GB; null/undefined when unknown (non-NVIDIA / no nvidia-smi). */
  vramGB?: number | null;
  /** Total system RAM in GB; null/undefined when unknown. */
  ramGB?: number | null;
}

export interface FitResult {
  level: FitLevel;
  /** True when the model can run at all (in VRAM or via CPU/RAM offload). False only for `wont-fit`. */
  canOffload: boolean;
  /** Short, human, actionable one-liner suitable for a tooltip. */
  reason: string;
  /** Estimated VRAM the model needs, GB (rounded to 1dp) — for badges/tooltips. */
  neededVramGB: number;
}

/** sd.cpp keeps weights resident in VRAM; add runtime/activation overhead on top of the file size. */
const ACTIVATION_OVERHEAD_GB = 1.5;
/** How far the estimate may exceed VRAM and still count as "tight" (may squeak by). */
const TIGHT_BAND_GB = 1.5;
/** Offloaded weights must fit within this fraction of total RAM (leave OS/app headroom). */
const RAM_HEADROOM_FACTOR = 0.85;

function gbFromBytes(bytes: number): number {
  return Math.max(0, bytes) / 1_000_000_000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Estimated VRAM (GB, 1 dp) a model needs — the number `evaluateFit` grades:
 * never below the size-based estimate, never below a declared floor.
 * Hardware-independent, so catalogs can label entries before any GPU is known.
 */
export function estimateNeededVramGB(requirement: FitRequirement): number {
  const estimateGB = gbFromBytes(requirement.sizeBytes) + ACTIVATION_OVERHEAD_GB;
  return round1(Math.max(estimateGB, requirement.minVramGB ?? 0));
}

/**
 * Coarse hardware class a catalog entry belongs to, derived from the same
 * estimate the fit badge uses so the two never disagree. The badge stays the
 * per-machine truth; the tier is the catalog's "who is this for" label
 * (docs/ai-models-redesign.md §3.3).
 */
export type HardwareTier = 'laptop' | 'mid' | 'high' | 'top';

export const HARDWARE_TIER_LABELS: Record<HardwareTier, string> = {
  laptop: 'Laptop · up to 4 GB',
  mid: '6–8 GB GPU',
  high: '12 GB GPU',
  top: '16 GB+ GPU',
};

export function hardwareTierFor(neededVramGB: number): HardwareTier {
  if (neededVramGB <= 4) return 'laptop';
  if (neededVramGB <= 8) return 'mid';
  if (neededVramGB <= 12) return 'high';
  return 'top';
}

/**
 * Estimate the VRAM (GB) a model needs and grade it against the hardware.
 *
 * @param requirement `minVramGB` (optional floor) + `sizeBytes` (drives the estimate).
 * @param hardware detected `vramGB` / `ramGB` (either may be unknown).
 */
export function evaluateFit(requirement: FitRequirement, hardware: FitHardware): FitResult {
  const estimateGB = gbFromBytes(requirement.sizeBytes) + ACTIVATION_OVERHEAD_GB;
  // Effective need: never below the size estimate, never below a declared floor.
  const neededVramGB = estimateNeededVramGB(requirement);

  const vramGB = hardware.vramGB ?? null;
  const ramGB = hardware.ramGB ?? null;

  // Unknown VRAM → don't guess, don't warn.
  if (vramGB === null || vramGB <= 0) {
    return {
      level: 'unknown',
      canOffload: true,
      reason: `GPU memory couldn't be detected — needs ~${neededVramGB} GB; run to see if it fits.`,
      neededVramGB,
    };
  }

  if (neededVramGB <= vramGB) {
    return {
      level: 'ok',
      canOffload: true,
      reason: `Fits your ${round1(vramGB)} GB GPU (needs ~${neededVramGB} GB).`,
      neededVramGB,
    };
  }

  if (neededVramGB <= vramGB + TIGHT_BAND_GB) {
    return {
      level: 'tight',
      canOffload: true,
      reason: `Close to your ${round1(vramGB)} GB VRAM limit (needs ~${neededVramGB} GB) — may be slow or need CPU offload.`,
      neededVramGB,
    };
  }

  // Clearly over VRAM. Offloading moves weights to system RAM (slower but works).
  const neededRamGB = round1(estimateGB);
  if (ramGB !== null && ramGB > 0 && neededRamGB > ramGB * RAM_HEADROOM_FACTOR) {
    return {
      level: 'wont-fit',
      canOffload: false,
      reason: `Needs ~${neededVramGB} GB but you have ${round1(vramGB)} GB VRAM / ${round1(ramGB)} GB RAM — too large to run.`,
      neededVramGB,
    };
  }

  return {
    level: 'offload',
    canOffload: true,
    reason: `Too big for ${round1(vramGB)} GB VRAM (needs ~${neededVramGB} GB) — will offload to CPU/RAM (slower).`,
    neededVramGB,
  };
}
