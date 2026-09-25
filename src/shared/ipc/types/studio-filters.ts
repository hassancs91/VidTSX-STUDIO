// Filter packs (docs/studio/FILTER_PACKS_DESIGN.md "Delivery") — the list the
// Filters and Effects tabs show, and module delivery for the preview. File
// paths stay in main: the renderer asks by document kind and gets a
// module-server URL it dynamic-imports.

import type { FilterCategory, FilterParameter, FilterPreset } from '../../types/studio-effects';

/** A filter as the tabs list it — the manifest entry, so the Inspector never waits for a module. */
export interface StudioFilterInfo {
  /** `<packId>/<itemId>`, e.g. 'core/noir' — what the document stores. */
  kind: string;
  name: string;
  packId: string;
  packName: string;
  /** Which tab lists it and which of a clip's two slots it fills. */
  category: FilterCategory;
  animated: boolean;
  /** 0–1; the intensity slider's starting value. */
  defaultIntensity: number;
  parameters: FilterParameter[];
  presets: FilterPreset[];
  /** Slow enough for the card to say so — informational, not a warning. */
  heavy: boolean;
  /** Per-frame analysis the item needs ('faceTrack', …) — the editor queues
   *  the matching job when it is applied (FILTER_PACKS_DESIGN.md "Analysis tracks"). */
  requires: string[];
  version: string;
  tier?: string;
  tagline?: string;
  description?: string;
  /** `#rrggbb`, the card's accent. */
  accent?: string;
  symbol?: string;
}

export interface StudioFilterListResponse {
  success: boolean;
  filters?: StudioFilterInfo[];
  error?: string;
}

export interface StudioFilterModuleRequest {
  kind: string;
}

export interface StudioFilterModuleResponse {
  success: boolean;
  /** Module-server URL the renderer dynamic-imports; its default export is the FilterDefinition. */
  moduleUrl?: string;
  /** True when the kind simply isn't installed — the clip shows its plain
   *  picture, which is not an error the user must fix. */
  notInstalled?: boolean;
  error?: string;
}
