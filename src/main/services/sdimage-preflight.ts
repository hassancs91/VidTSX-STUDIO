/**
 * Image model VRAM/RAM preflight (hardening backlog A5).
 *
 * Bridges the electron-free core {@link evaluateFit} with the image adapter:
 * resolves each model's effective memory requirement (per-profile override →
 * family floor → size estimate) and grades it against the detected hardware.
 * Used both for the at-a-glance fit badge (scan) and to guard the generation
 * path (block "won't fit", auto-enable CPU offload when "over VRAM").
 */
import { evaluateFit, type FitRequirement, type FitResult } from '@shared/model-library/fit';
import type { InstalledModel } from '@shared/model-library/types';
import { ModelLibraryError } from '@shared/model-library/types';
import type { SdGenerationRequest, SdModelFamily, SdModelMeta } from '../../local-image-engine/types';
import { imageLocalEngine } from '../../local-image-engine';
import { getLastScan, scanImageLibrary } from './sdimage-library';
import { FAMILY_REQUIREMENTS } from '../../local-image-engine/family-presets';
import { SD_MODEL_CATALOG, type SdModelProfile } from '../../local-image-engine/model-registry';
import { getPreflightHardware, type PreflightHardware } from './system-info';

/** Family-level VRAM floor (a per-profile `requirements.minVramGB` overrides it). */
function familyFloor(family: SdModelFamily): number | undefined {
  return FAMILY_REQUIREMENTS[family]?.minVramGB;
}

/** Requirement for a catalog profile: per-profile override → family floor, plus its size. */
export function requirementForProfile(profile: SdModelProfile): FitRequirement {
  return {
    minVramGB: profile.requirements?.minVramGB ?? familyFloor(profile.meta.family),
    sizeBytes: profile.sizeBytes,
  };
}

/**
 * Requirement for an installed model. Profile-origin models inherit the catalog
 * profile's floor; custom imports rely purely on the size estimate (no floor).
 */
export function requirementForInstalled(installed: InstalledModel<SdModelMeta>): FitRequirement {
  if (installed.origin === 'custom') {
    return { sizeBytes: installed.sizeBytes };
  }
  const profile = SD_MODEL_CATALOG.find((p) => p.id === installed.id);
  return {
    minVramGB: profile?.requirements?.minVramGB ?? familyFloor(installed.meta.family),
    sizeBytes: installed.sizeBytes,
  };
}

/** Grade a requirement against a hardware snapshot (pure convenience). */
export function fitFor(requirement: FitRequirement, hardware: PreflightHardware): FitResult {
  return evaluateFit(requirement, { vramGB: hardware.vramGB, ramGB: hardware.ramGB });
}

/** Grade one installed model against the (cached) detected hardware. */
export async function evaluateInstalledFit(installed: InstalledModel<SdModelMeta>): Promise<FitResult> {
  const hardware = await getPreflightHardware();
  return fitFor(requirementForInstalled(installed), hardware);
}

/** True when the request already opts into any CPU-offload flag. */
function hasOffloadFlag(request: SdGenerationRequest): boolean {
  return Boolean(request.offloadToCpu || request.clipOnCpu || request.vaeOnCpu);
}

/**
 * Generation-path preflight (backlog A5): block models too big for VRAM *and*
 * RAM with a friendly typed error; auto-enable CPU offload for over-VRAM
 * models instead of letting sd-cli OOM. Missing/unscanned models fall through
 * to the engine's own "not installed" handling.
 */
export async function applySdGenerationPreflight(
  request: SdGenerationRequest,
): Promise<{ request: SdGenerationRequest; autoOffloadEnabled: boolean }> {
  const modelId = request.modelId ?? imageLocalEngine.getActiveModelId();
  if (!modelId) return { request, autoOffloadEnabled: false };

  const installed =
    getLastScan()?.installed.find((m) => m.id === modelId) ??
    (await scanImageLibrary()).installed.find((m) => m.id === modelId);
  if (!installed) return { request, autoOffloadEnabled: false };

  const fit = await evaluateInstalledFit(installed);
  if (fit.level === 'wont-fit') {
    throw new ModelLibraryError('insufficient-memory', fit.reason);
  }
  if (fit.level === 'offload' && !hasOffloadFlag(request)) {
    return { request: { ...request, offloadToCpu: true }, autoOffloadEnabled: true };
  }
  return { request, autoOffloadEnabled: false };
}
