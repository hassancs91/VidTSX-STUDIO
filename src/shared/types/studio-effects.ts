/**
 * Per-clip filters and effects (docs/studio/FILTER_PACKS_DESIGN.md).
 *
 * Two families of types live here. The DOCUMENT side is `StudioClipEffect`,
 * the entry a clip stores in its `effects[]`. The RUNTIME side is the
 * add-ons' filter SDK contract (`D:/repos/vidtsx-addons/filters/core/types.ts`),
 * carried verbatim: a pack filter is a `FilterDefinition` whose `render`
 * paints a Canvas 2D context, and the host — `filter-runtime.ts` — feeds it
 * frames. Filters never see React or Remotion.
 */

/** A pack filter's namespaced id `<packId>/<itemId>` (e.g. `core/noir`). */
export type StudioEffectKind = string;

/**
 * One entry of a clip's `effects[]`. `params` holds `intensity` (0–1, the
 * renderer's blend) plus the filter's own keys; a value equal to the filter's
 * default is dropped by the ops, so documents never accumulate no-op state.
 * A kind whose pack is not installed renders the plain picture and STAYS in
 * the document, so reinstalling the pack restores it.
 */
export interface StudioClipEffect {
  kind: StudioEffectKind;
  params?: Record<string, number | string>;
  disabled?: boolean;
}

// ---- The add-ons' SDK contract (runtime) -----------------------------------

export type FilterTier = 'common' | 'intermediate' | 'advanced';

/** Which gallery an item lists in and which of a clip's two slots it fills. */
export type FilterCategory = 'filter' | 'effect';

export interface FilterPoint {
  x: number;
  y: number;
}

/** Normalised to the input frame, before mirroring. */
export interface FilterFace {
  center: FilterPoint;
  width: number;
  height: number;
  rotation: number;
  leftEye: FilterPoint;
  rightEye: FilterPoint;
  nose: FilterPoint;
  mouth: FilterPoint;
  forehead: FilterPoint;
  mouthOpen?: number;
}

export interface FilterOptions {
  intensity?: number;
  speed?: number;
  mirror?: boolean;
  /** Per-effect values; unknown keys are ignored and invalid values use defaults. */
  parameters?: Readonly<Record<string, number | string>>;
}

/** Full input-frame alpha mask: 0 background, 255 subject; no crop or mirror. */
export interface FilterSubjectMask {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  /** Source-frame seconds, independent of effect animation speed. */
  time: number;
}

export type FilterParameter =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; default: number; unit?: string }
  | { key: string; label: string; type: 'color'; default: string };

export interface FilterPreset {
  id: string;
  name: string;
  parameters: Readonly<Record<string, number | string>>;
}

export interface FilterFrameInput {
  source: CanvasImageSource;
  /** Seconds. Explicit time makes exports deterministic. */
  time: number;
  /** Decoded source-frame time; defaults to time. */
  sourceTime?: number;
  subjectMask?: FilterSubjectMask;
  /** Omit or use [] to render face effects as an unchanged frame. */
  faces?: readonly FilterFace[];
  options?: FilterOptions;
}

export interface FilterRenderContext {
  ctx: CanvasRenderingContext2D;
  source: HTMLCanvasElement;
  scratch: HTMLCanvasElement;
  width: number;
  height: number;
  time: number;
  intensity: number;
  faces: readonly FilterFace[];
  subjectMask?: HTMLCanvasElement;
  parameters: Readonly<Record<string, number | string>>;
  /** Reusable, effect-scoped buffers owned and disposed by the renderer. */
  buffer: (name: string, width: number, height: number) => HTMLCanvasElement;
}

/** A pack filter's default export. `id` is the pack-local slug. */
export interface FilterDefinition {
  id: string;
  name: string;
  tier: FilterTier;
  tagline: string;
  description: string;
  accent: string;
  symbol: string;
  faceTracking: boolean;
  subjectTracking?: boolean;
  parameters?: readonly FilterParameter[];
  presets?: readonly FilterPreset[];
  animated: boolean;
  defaultIntensity: number;
  render: (frame: FilterRenderContext) => void;
}
