// Craft packs for `generate_composition` (TSX_BUILDER_DESIGN.md P4 part 3,
// P4-6 (a)). An agent names pack ids in `packs`; the flow node picks a Kind
// and a Style (configSchema only: a built-in flow.json names neither, so it
// builds as before). The ids are checked against the app's built-in packs
// before a folder is reserved, the way the job engine checks the Creator's,
// and at most one is a style. "Your own style" takes the user's words from
// `styleNotes`, which then reach the builder as its STYLE block instead of a
// note in the brief.
//
// The node's options are a fixed list here (a select's options are static);
// composition-packs.test.ts pins them, and the ids the description names, to
// resources/packs, so a new built-in pack fails a test until it is offered.

import { z } from 'zod';
import type { ConfigField } from '../../../../shared/types/flows';
import { CUSTOM_STYLE_ID } from '../../../../shared/studio/craft-pack';
import { craftPacksProblem, listCraftPacks } from '../../tsx-builder/craft-packs';

/** The node's "no pack" value. */
export const NO_PACK = 'none';

/** The forms and styles the node offers, as the Creator's pickers name them. */
export const NODE_KIND_PACKS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'core/infographic-loop', name: 'Infographic loop' },
];
export const NODE_STYLE_PACKS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'core/style-blueprint', name: 'Blueprint' },
  { id: 'core/style-flat-bold', name: 'Flat bold' },
  { id: 'core/style-neon-dark', name: 'Neon dark' },
  { id: 'core/style-editorial', name: 'Editorial' },
  { id: CUSTOM_STYLE_ID, name: 'Your own style' },
];

export const packsSchema = z
  .array(z.string())
  .optional()
  .describe(
    "Craft packs: the builder's own know-how for a kind of piece or a look, by id; it follows them, so the brief need not repeat them. " +
      'core/infographic-loop = an animated infographic post (one whole picture on every frame, a seamless loop, numbers drawn as countable marks); it brings core/concept-to-picture, and suits 1080x1350, 8 s, loop, budget craft. ' +
      "One style at most: core/style-blueprint, core/style-flat-bold, core/style-neon-dark, core/style-editorial, or core/style-custom with the user's own words for the look in styleNotes. Absent = none.",
  );

export const kindPackSchema = z
  .string()
  .optional()
  .describe('Flows only: the node\'s Kind select (a form pack id, or "none"). An agent puts ids in `packs`.');
export const stylePackSchema = z
  .string()
  .optional()
  .describe('Flows only: the node\'s Style select (a style pack id, or "none"). An agent puts ids in `packs`.');

/** The node's Kind and Style selects. */
export const PACK_FIELDS: ConfigField[] = [
  {
    kind: 'select',
    key: 'kindPack',
    label: 'Kind',
    options: [{ value: NO_PACK, label: 'None — a plain composition' }, ...NODE_KIND_PACKS.map((p) => ({ value: p.id, label: p.name }))],
  },
  {
    kind: 'select',
    key: 'stylePack',
    label: 'Style',
    options: [
      { value: NO_PACK, label: 'None — the builder picks' },
      ...NODE_STYLE_PACKS.map((p) => ({
        value: p.id,
        label: p.id === CUSTOM_STYLE_ID ? 'Your own — the words in Style notes' : p.name,
      })),
    ],
  },
];

export interface PackArgs {
  packs?: string[];
  kindPack?: string;
  stylePack?: string;
  styleNotes?: string;
}

export interface CompositionPacks {
  /** In the order named; [] = none. */
  packs: string[];
  /** "Your own style": the user's words, for the builder's STYLE block. */
  style?: string;
}

/** The packs a call names, checked; or why they cannot run. `root` is for tests. */
export function compositionPacks(args: PackArgs, root?: string): CompositionPacks | { error: string } {
  const named = [...(args.packs ?? []), args.kindPack, args.stylePack]
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id) && id !== NO_PACK);
  const packs = [...new Set(named)];
  if (packs.length === 0) return { packs };
  const problem = craftPacksProblem(packs, root);
  if (problem) return { error: problem };
  const styleIds = new Set(listCraftPacks(root).filter((p) => p.role === 'style').map((p) => p.id));
  const styles = packs.filter((id) => styleIds.has(id));
  if (styles.length > 1) return { error: `One style pack at most; this call names ${styles.length}: ${styles.join(', ')}.` };
  if (!packs.includes(CUSTOM_STYLE_ID)) return { packs };
  const words = args.styleNotes?.trim();
  if (!words) return { error: `${CUSTOM_STYLE_ID} needs the user's own words for the look in styleNotes.` };
  return { packs, style: words };
}
