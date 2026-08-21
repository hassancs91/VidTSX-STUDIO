// @vidtsx/kit — the house easing family. Calm, premium motion: use these with
// interpolate() instead of raw Easing.out(...) wrappers so every shot shares
// the same movement vocabulary.
import { Easing } from 'remotion';

export const EASINGS = {
  /** Default for entrances and settles. */
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
  /** Exits. */
  easeIn: Easing.bezier(0.32, 0, 0.67, 0),
  /** Travel between two on-screen positions; also typing pace. */
  easeInOut: Easing.bezier(0.37, 0, 0.63, 1),
  /** Gentle overshoot for small UI elements (chips, pills) — no cartoon bounce. */
  overshoot: Easing.bezier(0.34, 1.4, 0.64, 1),
} as const;
