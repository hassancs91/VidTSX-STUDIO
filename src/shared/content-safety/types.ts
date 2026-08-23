/**
 * Content Safety — shared types for the always-on visual-generation gate.
 *
 * Electron-free by design: imported by the moderation/image engines (main),
 * IPC types, and renderer copy. See docs/CONTENT_SAFETY_DESIGN.md.
 */

/** Which gate produced a block: prompt word-list (A) or pixel classifier (B). */
export type ContentSafetyGate = 'prompt' | 'image';

/**
 * Why the content was blocked. `sexual`/`nudity`/`pornography` come from the
 * prompt gate's curated blocklist; `explicit`/`borderline` from the pixel
 * classifier's threshold bands.
 */
export type ContentSafetyCategory =
  | 'sexual'
  | 'nudity'
  | 'pornography'
  | 'explicit'
  | 'borderline';

/**
 * Plain-serializable block descriptor carried on IPC response types as
 * `blocked?: ContentSafetyBlockInfo` — the class in
 * `moderation-blocked-error.ts` is destructured into this at the IPC
 * boundary and never crosses as a class (SdCliError precedent).
 */
export interface ContentSafetyBlockInfo {
  gate: ContentSafetyGate;
  category: ContentSafetyCategory;
}
