// Transition packs (docs/studio/TRANSITION_PACKS_DESIGN.md) — the list the
// Transitions tab shows, and module delivery for the preview. File paths stay
// in main: the renderer asks by document kind and gets a module-server URL.

import type { SceneCopies } from '../../studio/transition-pack';

/** A transition as the tab lists it. */
export interface StudioTransitionInfo {
  /** `<packId>/<itemId>`, e.g. 'core/push-left' — what the document stores. */
  kind: string;
  name: string;
  packId: string;
  packName: string;
  description?: string;
  usage?: string;
  tier?: string;
  /** The length a card click applies. */
  durationSeconds: number;
  /** 'multi' mounts a scene more than once — the card's "heavy" badge. */
  sceneCopies: SceneCopies;
  version: string;
}

export interface StudioTransitionListResponse {
  success: boolean;
  transitions?: StudioTransitionInfo[];
  error?: string;
}

export interface StudioTransitionModuleRequest {
  kind: string;
}

export interface StudioTransitionModuleResponse {
  success: boolean;
  /** Module-server URL the renderer dynamic-imports into the Player. */
  moduleUrl?: string;
  /** True when the kind simply isn't installed — the boundary falls back to a
   *  crossfade, which is not an error the user must fix. */
  notInstalled?: boolean;
  error?: string;
}

// Importing packages (`.vidtsxpack` / `.vidtsxtransition`, P5) lives in
// `studio-packages.ts` — one dialog serves transitions and filters.
