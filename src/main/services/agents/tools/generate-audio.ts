// `generate_audio` — sound effects and music through the audio generation
// engine (V1 completion plan §2.2 W2b), behind the shared tool contract.
//
// BLOCKING is correct: ElevenLabs answers a sound effect in seconds and a
// music track in well under a minute — inside the long-jobs envelope (§1.5),
// the same call the Studio agent's `generate_sfx` / `generate_music` make.
// The file is born-managed library content (origin `generated`, the prompt
// as its description, brand-tagged) and comes back as an `audio` artifact.
//
// W8 Stage 3 (flows plan §0.1 item 8): also a node — `prompt` in, `audio`
// out, `kind` and the length in the inspector, priced with the provider's
// per-second rate (ElevenLabs' published $0.002 / $0.0025 when no provider
// is registered at list time). Per-node `brandId` per §0.1 item 9.

import { z } from 'zod';
import type { AudioCompositionPlan } from '../../../../audio-engine/generation';
import { audioGenerationEngine } from '../../../../audio-engine/generation';
import {
  generateAudioAsset,
  hasAudioProvider,
  NO_AUDIO_PROVIDER_MESSAGE,
} from '../../library/generate-audio-asset';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { resolveNodeBrand } from './session-brand';

const KINDS = ['sfx', 'music'] as const;

/** ElevenLabs' published rates (W2b) — the hint when no provider is registered yet. */
const PUBLISHED_RATE_USD_PER_SECOND: Record<(typeof KINDS)[number], number> = { sfx: 0.002, music: 0.0025 };

/** §0.1 item 6: the per-second rate per kind, the engine's when a provider is registered. */
export function audioPriceHint(): string {
  return KINDS.map((kind) => {
    const rate = audioGenerationEngine.getPricePerSecondUsd(kind) ?? PUBLISHED_RATE_USD_PER_SECOND[kind];
    return `${kind} $${rate}/s`;
  }).join(', ');
}

const onOff = z.union([z.boolean(), z.enum(['on', 'off'])]);
const isOn = (value: boolean | 'on' | 'off' | undefined): boolean | undefined =>
  value === undefined ? undefined : value === true || value === 'on';

const compositionPlanSchema = z
  .object({
    positiveGlobalStyles: z.array(z.string()).optional(),
    negativeGlobalStyles: z.array(z.string()).optional(),
    sections: z
      .array(
        z.object({
          name: z.string(),
          durationSec: z.number().positive(),
          positiveStyles: z.array(z.string()).optional(),
          negativeStyles: z.array(z.string()).optional(),
          lines: z.array(z.string()).optional(),
        }),
      )
      .min(1),
  })
  .describe('Music only: a structured plan INSTEAD of a prompt — global styles plus timed sections');

const schema = {
  kind: z.enum(KINDS).describe('"sfx" for a sound effect (0.5–30 s), "music" for a track (3–600 s)'),
  prompt: z
    .string()
    .optional()
    .describe('The sound or the song in words. Required for sfx; music takes it OR a compositionPlan.'),
  durationSeconds: z.coerce
    .number()
    .optional()
    .describe('Length in seconds. sfx: omit (or 0) to let the model choose. music: prompt form only.'),
  loop: onOff.optional().describe('sfx: loop seamlessly (ambiences).'),
  promptInfluence: z.number().min(0).max(1).optional().describe('sfx: 0–1, how literally to follow the prompt.'),
  instrumental: onOff.optional().describe('music: guarantee no vocals (default true).'),
  compositionPlan: compositionPlanSchema.optional(),
  seed: z.number().int().optional().describe('music, with a composition plan only.'),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe('Flows only: a brand for this step; null = no brand; absent = the run\'s brand.'),
};

interface GenerateAudioArgs {
  kind: (typeof KINDS)[number];
  prompt?: string;
  durationSeconds?: number;
  loop?: boolean | 'on' | 'off';
  promptInfluence?: number;
  instrumental?: boolean | 'on' | 'off';
  compositionPlan?: AudioCompositionPlan;
  seed?: number;
  brandId?: string | null;
}

export const generateAudioTool: AgentToolDef<GenerateAudioArgs> = {
  id: 'generate_audio',
  description:
    'Generate one sound effect or music track with the configured audio provider (ElevenLabs) and file it in the asset library under this session\'s folder. Takes seconds (sound effects about $0.002 per second of audio, music about $0.0025). Returns an "audio" artifact.',
  needs: 'audio-provider',
  schema,
  ports: {
    label: 'Generate Audio',
    category: 'audio',
    priced: true,
    priceHint: audioPriceHint,
    inputs: [{ id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' }],
    outputs: [{ id: 'audio', label: 'Audio', dataType: 'audio', from: 'artifact' }],
    configSchema: [
      {
        kind: 'select',
        key: 'kind',
        label: 'Kind',
        options: [
          { value: 'sfx', label: 'Sound effect (0.5–30 s)' },
          { value: 'music', label: 'Music (3–600 s)' },
        ],
      },
      { kind: 'number', key: 'durationSeconds', label: 'Seconds (0 = let the model choose)', min: 0, max: 600, step: 0.5 },
      {
        kind: 'select',
        key: 'loop',
        label: 'Loop (sfx)',
        options: [
          { value: 'off', label: 'No' },
          { value: 'on', label: 'Seamless loop' },
        ],
      },
      {
        kind: 'select',
        key: 'instrumental',
        label: 'Vocals (music)',
        options: [
          { value: 'on', label: 'Instrumental only' },
          { value: 'off', label: 'Allow vocals' },
        ],
      },
      { kind: 'text', key: 'brandId', label: 'Brand id (optional)', placeholder: 'run brand' },
    ],
    defaultConfig: { kind: 'sfx', durationSeconds: 0, loop: 'off', instrumental: 'on' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    if (!(await hasAudioProvider())) return toolText(NO_AUDIO_PROVIDER_MESSAGE, true);
    if (args.kind === 'music' && !args.prompt && !args.compositionPlan) {
      return toolText('Music needs a prompt or a compositionPlan.', true);
    }
    ctx.emitProgress((args.prompt ?? 'composition plan').slice(0, 60));
    const featureSource = ctx.featureSource ?? 'agent';
    const brandId = resolveNodeBrand(args.brandId, ctx.brandId);
    const loop = isOn(args.loop);
    const instrumental = isOn(args.instrumental);
    try {
      const asset = await generateAudioAsset({
        kind: args.kind,
        ...(args.prompt ? { prompt: args.prompt } : {}),
        ...(args.durationSeconds ? { durationSec: args.durationSeconds } : {}),
        ...(loop !== undefined ? { loop } : {}),
        ...(args.promptInfluence !== undefined ? { promptInfluence: args.promptInfluence } : {}),
        ...(args.kind === 'music' ? { instrumental: instrumental ?? true } : {}),
        ...(args.compositionPlan ? { compositionPlan: args.compositionPlan } : {}),
        ...(args.seed !== undefined ? { seed: args.seed } : {}),
        featureSource,
        ...(featureSource === 'agent' ? { agentId: ctx.agentId } : {}),
        ...(ctx.libraryFolder ? { folder: ctx.libraryFolder } : {}),
        ...(brandId ? { brandId } : {}),
        signal: ctx.signal,
      });
      const cost = asset.costUsd !== undefined ? `, $${asset.costUsd.toFixed(3)}` : '';
      return {
        ...toolText(
          `${args.kind === 'sfx' ? 'Sound effect' : 'Music'} generated: ${asset.relPath} (${asset.durationSeconds} s${cost}${asset.brandId ? `, brand: ${asset.brandId}` : ''}).`,
        ),
        artifact: {
          kind: 'audio',
          title: asset.description.slice(0, 80) || (args.kind === 'sfx' ? 'Sound effect' : 'Music'),
          payload: { relPath: asset.relPath, durationSeconds: asset.durationSeconds, sound: args.kind },
        },
      };
    } catch (err) {
      return toolText(
        `Audio generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
