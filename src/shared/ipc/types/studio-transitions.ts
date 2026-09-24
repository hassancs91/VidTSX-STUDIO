// Transition packs (docs/studio/TRANSITION_PACKS_DESIGN.md) — the list the
// Transitions tab shows, and module delivery for the preview. File paths stay
// in main: the renderer asks by document kind and gets a module-server URL.

import type { SceneCopies } from '../../studio/transition-pack';
import type { VersionAction } from '../../studio/transition-package';

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

// ---- Import: `.vidtsxpack` / `.vidtsxtransition` (P5) ----------------------

/** One transition in a package, as the inspect-then-install dialog lists it. */
export interface InspectedTransitionItem {
  /** The document id it installs as — `<packId>/<id>`, or `imported/<id>`. */
  kind: string;
  name: string;
  version: string;
  durationSeconds: number;
  sceneCopies: SceneCopies;
  description?: string;
  /** Why the import gate refused this one; the rest of the pack still installs. */
  refused?: string;
}

export interface InspectedTransitionPackage {
  format: 'pack' | 'single';
  /** Target pack folder — the pack's own id, or `imported` for a single. */
  packId: string;
  /** The pack's name, or the single transition's name. */
  name: string;
  version: string;
  author?: string;
  license?: string;
  description?: string;
  /** Against what is installed: per pack for a pack, per item for a single. */
  action: VersionAction;
  installedVersion?: string;
  items: InspectedTransitionItem[];
  /** Entries the manifest parser skipped — informational. */
  problems: string[];
}

export interface StudioTransitionPackageInspectRequest {
  /** Omitted = main shows the open dialog first. */
  filePath?: string;
}

export interface StudioTransitionPackageInspectResponse {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  package?: InspectedTransitionPackage;
  error?: string;
}

export interface StudioTransitionPackageInstallRequest {
  filePath: string;
  /** The user saw "this replaces a newer version" and said yes. */
  confirmDowngrade?: boolean;
}

export interface StudioTransitionPackageInstallResponse {
  success: boolean;
  /** Nothing written: an older version needs an explicit yes first. */
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  /** Nothing written: this exact version is already installed. */
  unchanged?: boolean;
  installed?: { packId: string; kinds: string[] };
  /** Items the gate refused (a pack installs the rest). */
  skipped?: Array<{ name: string; reason: string }>;
  error?: string;
}

export interface StudioTransitionPackagePendingResponse {
  filePath?: string;
}
