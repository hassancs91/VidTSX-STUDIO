// The Creator composer's first message as a `build` job (TSX_BUILDER_DESIGN.md
// P3 part 2): the format the user fixed, the budget, brand and reference
// images. Length "Auto" sends no frame count, so the builder decides it.

import type { BuildBudget, LlmImageIpc, TsxJobStartRequest } from '@shared/ipc/types';
import { BUDGET_CAPS, BUDGET_ROUNDS } from '@shared/tsx-engine/build-budgets';
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

export const BUDGET_CHOICES: Array<{ value: BuildBudget; label: string }> = [
  { value: 'quick', label: 'Quick' },
  { value: 'standard', label: 'Standard' },
  { value: 'craft', label: 'Craft' },
];

/** "up to 3 looks · stops at 30 min": what the picked budget buys. */
export function budgetHint(budget: BuildBudget): string {
  const rounds = BUDGET_ROUNDS[budget];
  const looks = rounds === 1 ? '1 look' : `up to ${rounds} looks`;
  return `${looks} · stops at ${BUDGET_CAPS[budget].minutes} min`;
}

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
