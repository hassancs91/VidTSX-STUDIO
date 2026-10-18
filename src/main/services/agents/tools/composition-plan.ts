// The job request a `generate_composition` call makes (split out of
// generate-composition.ts in P4 part 3, to keep it under 300 lines): a new
// build from a brief, or `from` = an earlier composition's own request built
// again (composition-rebuild.ts). Both check their craft packs before the tool
// reserves a folder (composition-packs.ts).

import type { BuildFormat, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { AgentToolContext } from './types';
import { isOn, type BUILD_BUDGETS } from './composition-args';
import { compositionPacks, NO_PACK } from './composition-packs';
import { rebuildNote, rebuildSource } from './composition-rebuild';
import { buildMediaFor, type BuildMedia } from './composition-media';
import { readSessionBrandInstructions, resolveNodeBrand } from './session-brand';

export const MODEL_MODES = ['required', 'preferred', 'default'] as const;

export interface GenerateCompositionArgs {
  title: string;
  brief?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  budget?: (typeof BUILD_BUDGETS)[number];
  loop?: boolean | 'on' | 'off';
  packs?: string[];
  generatedImages?: boolean | 'on' | 'off';
  styleNotes?: string;
  referenceImage?: string;
  referenceVideo?: string;
  from?: string;
  kindPack?: string;
  stylePack?: string;
  brandId?: string | null;
  providerId?: string;
  model?: string;
  modelMode?: (typeof MODEL_MODES)[number];
  reviseOf?: string;
  revision?: string;
}

/** A new build, planned: the job request and a line to open the result with. */
export type Planned = { request: TsxJobStartRequest; note?: string } | { error: string };

/** The model the build runs on, and whether it may generate images. */
export interface Binding {
  providerId?: string;
  model?: string;
  imagesOff: boolean;
}

const jobBinding = (b: Binding): Pick<TsxJobStartRequest, 'providerId' | 'options'> => ({
  ...(b.providerId ? { providerId: b.providerId } : {}),
  ...(b.model ? { options: { model: b.model } } : {}),
});

/** What a call shapes besides its title and budget: none of it goes with `from`. */
const SHAPING_KEYS = [
  'brief', 'width', 'height', 'fps', 'durationSeconds', 'loop', 'packs', 'kindPack', 'stylePack', 'styleNotes',
  'generatedImages', 'referenceImage', 'referenceVideo', 'brandId',
] as const;

/** `from`: the earlier composition's own request, unchanged but for the budget. */
export async function plannedRebuild(ctx: AgentToolContext, args: GenerateCompositionArgs, bind: Binding): Promise<Planned> {
  const from = args.from!;
  const extra = SHAPING_KEYS.filter((k) => args[k] !== undefined && !(k.endsWith('Pack') && args[k] === NO_PACK));
  if (extra.length) {
    return { error: `\`from\` builds ${from}'s own request again, unchanged; only title and budget go with it. Leave out: ${extra.join(', ')}.` };
  }
  const source = await rebuildSource(ctx, from);
  if ('error' in source) return source;
  const checked = compositionPacks({ packs: source.packs, ...(source.style ? { styleNotes: source.style } : {}) });
  if ('error' in checked) return { error: `${from} cannot be built again here: ${checked.error}` };
  const budget = args.budget ?? source.budget;
  const request: TsxJobStartRequest = {
    kind: 'build',
    prompt: source.intent,
    ...jobBinding(bind),
    build: {
      format: source.format,
      budget,
      packs: source.packs,
      ...(source.style ? { style: source.style } : {}),
      ...(source.brand ? { brand: source.brand } : {}),
      ...(source.imagesOff || bind.imagesOff ? { maxGeneratedImages: 0 } : {}),
    },
  };
  return { request, note: rebuildNote(from, source, budget) };
}

/** A brief, the session's brand and media, the packs it names. */
export async function plannedBuild(ctx: AgentToolContext, args: GenerateCompositionArgs, bind: Binding): Promise<Planned> {
  if (!args.brief?.trim()) {
    return { error: 'A brief is needed: what the piece shows and why (or `from` to build an earlier composition again).' };
  }
  const craft = compositionPacks(args);
  if ('error' in craft) return craft;
  // W7 / decision 7: the session's brand reaches the builder as the Creator
  // sends it. A flow node may override or opt out (§0.1 item 9).
  const brand = await readSessionBrandInstructions(resolveNodeBrand(args.brandId, ctx.brandId));
  let media: BuildMedia;
  try {
    media = await buildMediaFor(ctx, args);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  const fps = args.fps ?? 30;
  const format: BuildFormat = {
    width: args.width ?? 1920,
    height: args.height ?? 1080,
    fps,
    ...(args.durationSeconds ? { durationInFrames: Math.max(1, Math.round(args.durationSeconds * fps)) } : {}),
    ...(isOn(args.loop) ? { loop: true } : {}),
  };
  // "Your own style" words go to the builder as STYLE, not as a note.
  const notes = craft.style ? '' : args.styleNotes?.trim();
  const prompt = [args.brief, notes ? `Style notes: ${notes}` : '', ...media.notes].filter(Boolean).join('\n\n');
  const request: TsxJobStartRequest = {
    kind: 'build',
    prompt,
    ...jobBinding(bind),
    build: {
      format,
      budget: args.budget ?? 'standard',
      ...(craft.packs.length ? { packs: craft.packs } : {}),
      ...(craft.style ? { style: craft.style } : {}),
      ...(brand ? { brand } : {}),
      ...(media.referenceImages.length ? { referenceImages: media.referenceImages } : {}),
      ...(media.assets.length ? { assets: media.assets } : {}),
      ...(bind.imagesOff ? { maxGeneratedImages: 0 } : {}),
    },
  };
  return { request };
}
