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
import type { SdModelFamily, SdModelMeta } from '../../local-image-engine/types';
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
