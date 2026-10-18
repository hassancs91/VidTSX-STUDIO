// The Creator's Kind and Style pickers (TSX_BUILDER_DESIGN.md P4, P4-3 (a)):
// which craft packs a first build names. Kind = a `form` pack (it brings its
// own packs in main, and suggests the composer's settings); Style = a `style`
// pack, or "Your own…" = the custom-style pack plus the user's words. No pick
// sends no packs. Edits send none either: main keeps the version's own.

import { CUSTOM_STYLE_ID, type CraftPackInfo, type CraftSuggest } from '@shared/studio/craft-pack';
import type { BuildBudget } from '@shared/ipc/types';

/** The pack behind "Your own…": it tells the builder how to use the user's words. */
export { CUSTOM_STYLE_ID };

export interface CraftChoice {
  /** A form pack's id; '' = none. */
  kindId: string;
  /** A style pack's id (CUSTOM_STYLE_ID for "Your own…"); '' = none. */
  styleId: string;
  /** "Your own…": the user's words for the look. */
  customStyle: string;
}

export const NO_CRAFT: CraftChoice = { kindId: '', styleId: '', customStyle: '' };

export const kindOptions = (packs: readonly CraftPackInfo[]): CraftPackInfo[] => packs.filter((p) => p.role === 'form');

/** The named styles; "Your own…" is offered apart, after them. */
export const styleOptions = (packs: readonly CraftPackInfo[]): CraftPackInfo[] =>
  packs.filter((p) => p.role === 'style' && p.id !== CUSTOM_STYLE_ID);

export const hasCustomStyle = (packs: readonly CraftPackInfo[]): boolean => packs.some((p) => p.id === CUSTOM_STYLE_ID);

/** What a first build sends. "Your own…" with no words sends no style. */
export function craftRequest(choice: CraftChoice): { packs?: string[]; style?: string } {
  const words = choice.customStyle.trim();
  const custom = choice.styleId === CUSTOM_STYLE_ID;
  const packs = [choice.kindId, custom && !words ? '' : choice.styleId].filter(Boolean);
  if (packs.length === 0) return {};
  return { packs, ...(custom && words ? { style: words } : {}) };
}

const BUDGET_LABEL: Record<BuildBudget, string> = { quick: 'Quick', standard: 'Standard', craft: 'Craft' };

/** "4:5 · 8 s · Loop · Craft": what a form set, for the line under the Kind picker. */
export function suggestLine(suggest: CraftSuggest | undefined): string | null {
  if (!suggest) return null;
  const parts = [
    suggest.aspectRatio,
    suggest.seconds !== undefined ? `${suggest.seconds} s` : undefined,
    suggest.loop === undefined ? undefined : suggest.loop ? 'Loop' : 'No loop',
    suggest.budget ? BUDGET_LABEL[suggest.budget] : undefined,
  ].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(' · ') : null;
}
