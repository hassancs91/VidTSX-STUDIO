// The Creator composer's first message as a `build` job (TSX_BUILDER_DESIGN.md
// P3 part 2): the format the user fixed, the budget, brand and reference
// images. Length "Auto" sends no frame count, so the builder decides it.

import type { BuildBudget, LlmImageIpc, TsxJobStartRequest } from '@shared/ipc/types';
import { BUDGET_CHOICES, budgetHint } from '@shared/tsx-engine/build-budgets';
import type { AspectRatio } from '../types';
import { ASPECT_RATIO_OPTIONS } from '../types';

export interface ComposerBuildInput {
  prompt: string;
  providerId: string;
  /** '' = the provider's default. */
  model: string;
  aspectRatio: AspectRatio;
  fps: number;
  /** Seconds; ignored when `autoDuration`. */
  duration: number;
  autoDuration: boolean;
  /** Seamless loop: the last frame flows into frame 0. */
  loop: boolean;
  budget: BuildBudget;
  /** Brand guidance as text (buildBrandInstructions), if a brand is picked. */
  brand?: string;
  referenceImages: LlmImageIpc[];
}

export const DEFAULT_BUDGET: BuildBudget = 'standard';

// Moved to the shared budgets module (Studio's pickers show them too); re-exported for the Creator.
export { BUDGET_CHOICES, budgetHint };

export function buildJobRequest(input: ComposerBuildInput): TsxJobStartRequest | null {
  const prompt = input.prompt.trim();
  if (!prompt || !input.providerId) return null;
  const ratio = ASPECT_RATIO_OPTIONS.find((o) => o.value === input.aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  return {
    kind: 'build',
    prompt,
    providerId: input.providerId,
    ...(input.model ? { options: { model: input.model } } : {}),
    build: {
      format: {
        width: ratio.width,
        height: ratio.height,
        fps: input.fps,
        ...(input.autoDuration ? {} : { durationInFrames: Math.max(1, Math.round(input.duration * input.fps)) }),
        ...(input.loop ? { loop: true } : {}),
      },
      budget: input.budget,
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.referenceImages.length > 0 ? { referenceImages: input.referenceImages } : {}),
    },
  };
}
