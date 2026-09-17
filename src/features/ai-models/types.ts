import type { FitResult, HardwareTier } from '@shared/model-library/fit';

/**
 * The AI Models screen's sections — one rail entry each, grouped
 * (docs/ai-models-redesign.md §2). A section with a `flag` exists only when
 * that feature flag is on; the rail never shows an empty group.
 */
export type AiSectionId =
  | 'overview'
  | 'providers'
  | 'usage'
  | 'image'
  | 'video'
  | 'audio'
  | '3d'
  | 'llms'
  | 'embeddings'
  | 'safety';

export type AiSectionGroup = 'account' | 'local' | 'safety';

export interface AiSection {
  id: AiSectionId;
  label: string;
  group: AiSectionGroup;
  /** Feature flag (src/shared/feature-flags.ts) that must be on for the section to exist. */
  flag?: string;
}

/** Caption above each rail group; null = no caption (the group speaks for itself). */
export const AI_SECTION_GROUP_LABELS: Record<AiSectionGroup, string | null> = {
  account: null,
  local: 'Local models',
  safety: null,
};

export const AI_SECTION_GROUP_ORDER: readonly AiSectionGroup[] = ['account', 'local', 'safety'];

export const AI_SECTIONS: readonly AiSection[] = [
  { id: 'overview', label: 'Overview', group: 'account' },
  { id: 'providers', label: 'Providers', group: 'account' },
  { id: 'usage', label: 'Usage', group: 'account' },
  { id: 'image', label: 'Image', group: 'local' },
  { id: 'video', label: 'Video', group: 'local', flag: 'ai-video-models' },
  { id: 'audio', label: 'Audio', group: 'local' },
  { id: '3d', label: '3D', group: 'local', flag: 'ai-3d-models' },
  { id: 'llms', label: 'LLMs', group: 'local', flag: 'ai-llm-models' },
  { id: 'embeddings', label: 'Embeddings', group: 'local', flag: 'ai-embedding-models' },
  // Deliberately unflagged: the Content Safety page is always visible (D2d —
  // the gate has no off state, and the page is the advertised surface).
  { id: 'safety', label: 'Content Safety', group: 'safety' },
];

export const DEFAULT_AI_SECTION: AiSectionId = 'overview';

export function isAiSectionId(value: unknown): value is AiSectionId {
  return typeof value === 'string' && AI_SECTIONS.some((s) => s.id === value);
}

/**
 * One row of the local-model template's catalog lists (Recommended · All),
 * whatever the category's own model shape (docs/ai-models-redesign.md §3.3).
 * Pages map their scan / catalogue into this; the row component knows nothing
 * about categories.
 */
export interface CatalogRowData {
  id: string;
  name: string;
  /** Family key for the FamilyBadge (sd15 / flux1 / wan21 / whisper / …). */
  family: string;
  sizeLabel: string;
  /** Hardware class chip, derived from the same estimate as the Fits badge. */
  tier?: HardwareTier;
  fit?: FitResult;
  /** The "Tested" chip: an ISO date a release pass generated real output from this entry. */
  verifiedOn?: string;
  /** Second-line copy after the size (who this size is for). */
  hint?: string;
  /** Model page ("Get ↗"); link-only entries have this and no download. */
  sourceUrl?: string;
  /** True when a one-click download exists. */
  hasDownload: boolean;
}
