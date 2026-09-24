// Importing Studio pack packages — `.vidtsxpack` (transitions and filters
// together), `.vidtsxtransition`, `.vidtsxfilter` (TRANSITION_PACKS_DESIGN.md
// P5, FILTER_PACKS_DESIGN.md P5): the inspect-then-install dialog's view.

import type { FilterCategory } from '../../types/studio-effects';
import type { PackItemType, VersionAction } from '../../studio/pack-package';
import type { SceneCopies } from '../../studio/transition-pack';

/** One item in a package, as the dialog lists it. */
export interface InspectedPackageItem {
  type: PackItemType;
  /** The document id it installs as — `<packId>/<id>`, or `imported/<id>`. */
  kind: string;
  name: string;
  version: string;
  description?: string;
  /** Why the import gate refused this one; the rest of the pack still installs. */
  refused?: string;
  // Transitions:
  durationSeconds?: number;
  sceneCopies?: SceneCopies;
  // Filters:
  category?: FilterCategory;
  animated?: boolean;
  heavy?: boolean;
}

export interface InspectedPackage {
  format: 'pack' | 'single';
  /** Target pack folder — the pack's own id, or `imported` for a single. */
  packId: string;
  /** The pack's name, or the single item's name. */
  name: string;
  version: string;
  author?: string;
  license?: string;
  description?: string;
  /** Against what is installed: per pack for a pack, per item for a single. */
  action: VersionAction;
  installedVersion?: string;
  items: InspectedPackageItem[];
  /** Entries the manifest parser skipped — informational. */
  problems: string[];
}

export interface StudioPackPackageInspectRequest {
  /** Omitted = main shows the open dialog first. */
  filePath?: string;
  /** Which singles the picker offers beside `.vidtsxpack` (a tab asks for its
   *  own kind); omitted = every kind. */
  pick?: PackItemType[];
}

export interface StudioPackPackageInspectResponse {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  package?: InspectedPackage;
  error?: string;
}

export interface StudioPackPackageInstallRequest {
  filePath: string;
  /** The user saw "this replaces a newer version" and said yes. */
  confirmDowngrade?: boolean;
}

export interface StudioPackPackageInstallResponse {
  success: boolean;
  /** Nothing written: an older version needs an explicit yes first. */
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  /** Nothing written: this exact version is already installed. */
  unchanged?: boolean;
  installed?: { packId: string; kinds: string[]; types: PackItemType[] };
  /** Items the gate refused (a pack installs the rest). */
  skipped?: Array<{ name: string; reason: string }>;
  error?: string;
}

export interface StudioPackPackagePendingResponse {
  filePath?: string;
}
