// generate_sfx / generate_music (W2b): the audio generation engine behind two
// thin tools, AWAITED like generate_video — the providers answer in seconds,
// and the clip must be a project asset before insert_asset can place it. The
// clip is filed into the library (brand-tagged, prompt as description) and
// imported into the project on completion (the assets-imported pattern), so
// the agent's next call is `insert_asset(assetId, lane: "audio", at: …)`.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  MUSIC_MAX_SECONDS,
  MUSIC_MIN_SECONDS,
  SFX_MAX_SECONDS,
  SFX_MIN_SECONDS,
} from '../../../../audio-engine/generation';
import type { AudioCompositionPlan } from '../../../../audio-engine/generation';
import {
  generateAudioAsset,
  hasAudioProvider,
  NO_AUDIO_PROVIDER_MESSAGE,
  type GenerateAudioAssetRequest,
  type GeneratedAudioAsset,
} from '../../library/generate-audio-asset';
import { signed } from '../../library/format-level';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { importLibraryFile } from './library-import';
import { libraryReuseAnswer } from './sound-reuse';
import {
  emitProgress,
  emitTool,
  errorText,
  readProjectBrandId,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

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
          lines: z.array(z.string()).optional().describe('Lyric lines; omit for instrumental'),
        }),
      )
      .min(1),
  })
  .describe('A structured plan INSTEAD of a prompt: global styles plus timed sections');

const CATEGORY_HINT_SFX =
  'Sound category, one word from the library vocabulary: motion / tension / emphasis / snap / foley / reward / texture / impact';
const CATEGORY_HINT_MUSIC = 'Music category, one word: bed / sting / intro / outro / loop / transition';
const TAGS_HINT = 'Search tags for the library (lower-cased, deduplicated, at most 20): "whoosh", "air", "fast"';
const FORCE_HINT =
  'Generate even though the library has matching sounds — only after this tool returned library matches and none of them fits. The same on a miss: the tool answers the closest library sounds instead of generating, and force: true is the only way to generate while anything in the library scores.';
/** E3: what both descriptions say about the library check that runs first. */
const REUSE_NOTE =
  'It FIRST searches the asset library: when sounds there match the prompt it returns the top three as library:<path> refs (duration, category, tags, loudness, where used) INSTEAD of generating — no cost, no provider needed; place one with insert_asset, or call again with force: true if none fits. On a miss it answers the three closest library sounds instead of generating; only when nothing in the library scores does it generate without force.';

/** What the clip measures (E2): the loudness line, or the honest "kept raw" line. */
function describeLevel(filed: GeneratedAudioAsset): string {
  if (!filed.normalized) {
    return ` NOT loudness-normalized (${filed.normalizeError ?? 'unknown reason'}) — the raw file is kept.`;
  }
  if (filed.loudnessGated) {
    // EBU R128 gated it (N5): there is no integrated loudness to report — the peak was levelled instead.
    return filed.peakDbfs !== undefined
      ? ` Peak-normalized to ${signed(filed.peakDbfs)} dBTP — too short or too quiet for a loudness (LUFS) reading.`
      : ' Silent — no loudness or peak to level; kept as generated.';
  }
  const parts: string[] = [];
  if (filed.loudnessLufs !== undefined) parts.push(`${signed(filed.loudnessLufs)} LUFS`);
  if (filed.peakDbfs !== undefined) parts.push(`peak ${signed(filed.peakDbfs)} dBTP`);
  return parts.length > 0 ? ` Loudness ${parts.join(', ')}.` : '';
}

/** One generation → filed → imported → the line the agent reads back. */
async function generateAndImport(
  ctx: StudioToolContext,
  toolName: 'generate_sfx' | 'generate_music',
  req: Omit<GenerateAudioAssetRequest, 'brandId' | 'signal' | 'featureSource'>,
  placementHint: string,
) {
  if (!(await hasAudioProvider())) return text(NO_AUDIO_PROVIDER_MESSAGE, true);
  try {
    emitProgress(ctx, toolName, 'Generating at ElevenLabs…');
    const brandId = await readProjectBrandId(ctx.req.projectId);
    const filed = await generateAudioAsset({
      ...req,
      ...(brandId ? { brandId } : {}),
      featureSource: 'studio-shot-asset',
      signal: ctx.signal,
    });
    const asset = await importLibraryFile(ctx, filed.relPath);
    const cost = filed.costUsd !== undefined ? `, $${filed.costUsd.toFixed(3)}` : '';
    const brand = filed.brandId ? `, brand: ${filed.brandId}` : '';
    const facts = [
      ...(filed.category ? [`category: ${filed.category}`] : []),
      ...(filed.tags && filed.tags.length > 0 ? [`tags: ${filed.tags.join(', ')}`] : []),
    ];
    const filing = facts.length > 0 ? ` Filed with ${facts.join(' · ')}.` : '';
    return text(
      `${req.kind === 'sfx' ? 'Sound effect' : 'Music'} ready: project asset id "${asset.id}" (${LIBRARY_REF_PREFIX}${filed.relPath}, ${filed.durationSeconds.toFixed(2)} s${cost}${brand}).${describeLevel(filed)}${filing} It is in the project inventory now — ${placementHint}`,
    );
  } catch (err) {
    return text(`${req.kind === 'sfx' ? 'Sound effect' : 'Music'} generation failed: ${errorText(err)}`, true);
  }
}

export function buildAudioTools(ctx: StudioToolContext): StudioTool[] {
  const generateSfx = tool(
    'generate_sfx',
    `Generate ONE sound effect with the configured audio provider (ElevenLabs) and WAIT for it (seconds; about $0.002 per second of audio). Filed into the asset library (brand-tagged, prompt as description, loudness-normalized to −20 LUFS under a −1.5 dBTP ceiling, with category + tags for later reuse) and imported into this project; the result names the asset id for insert_asset (lane "audio"). Duration ${SFX_MIN_SECONDS}–${SFX_MAX_SECONDS} s, or omit it to let the model choose. ${REUSE_NOTE}`,
    {
      prompt: z.string().min(1).describe('The sound, concretely: "a fast airy whoosh with a short tail", "a soft UI click"'),
      durationSeconds: z.number().min(SFX_MIN_SECONDS).max(SFX_MAX_SECONDS).optional().describe('Length in seconds; omit for auto'),
      loop: z.boolean().optional().describe('Make it loop seamlessly (ambiences)'),
      promptInfluence: z.number().min(0).max(1).optional().describe('0–1, how literally to follow the prompt (default 0.3)'),
      category: z.string().min(1).max(40).optional().describe(CATEGORY_HINT_SFX),
      tags: z.array(z.string().min(1)).max(20).optional().describe(TAGS_HINT),
      force: z.boolean().optional().describe(FORCE_HINT),
    },
    async (args) => {
      emitTool(ctx, 'generate_sfx', args.prompt.slice(0, 60));
      // E3: reuse before generate — BEFORE the provider check, so it works with no key. A match or a
      // near miss (E-d15) answers from the library and generates nothing; only a true miss generates.
      if (!args.force) {
        const reuse = await libraryReuseAnswer('generate_sfx', args.prompt, { soundClass: 'sfx' });
        if (reuse) return text(reuse.text);
      }
      return generateAndImport(
        ctx,
        'generate_sfx',
        {
          kind: 'sfx',
          prompt: args.prompt,
          ...(args.durationSeconds !== undefined ? { durationSec: args.durationSeconds } : {}),
          ...(args.loop !== undefined ? { loop: args.loop } : {}),
          ...(args.promptInfluence !== undefined ? { promptInfluence: args.promptInfluence } : {}),
          ...(args.category !== undefined ? { category: args.category } : {}),
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
        },
        'place it with insert_asset (lane "audio", at the word or time it belongs to; its own length is the default duration).',
      );
    },
  );

  const generateMusic = tool(
    'generate_music',
    `Generate ONE music track with the configured audio provider (ElevenLabs Eleven Music) and WAIT for it (seconds to a minute; about $0.0025 per second of audio). Filed into the asset library (brand-tagged, loudness-normalized to −20 LUFS under a −1.5 dBTP ceiling, with category + tags for later reuse) and imported into this project; the result names the asset id for insert_asset (lane "audio"). Pass a prompt (with durationSeconds, ${MUSIC_MIN_SECONDS}–${MUSIC_MAX_SECONDS} s) OR a compositionPlan, never both. Beds under speech should be instrumental. ${REUSE_NOTE} (A compositionPlan always generates; a library bed shorter than durationSeconds is not offered.)`,
    {
      prompt: z.string().optional().describe('Genre, mood, instrumentation, tempo — "warm lo-fi hip-hop bed, mellow, 80 bpm, no vocals"'),
      durationSeconds: z.number().min(MUSIC_MIN_SECONDS).max(MUSIC_MAX_SECONDS).optional().describe('Length in seconds (prompt form only; a plan carries its own section lengths)'),
      instrumental: z.boolean().optional().describe('Guarantee no vocals (default true)'),
      compositionPlan: compositionPlanSchema.optional(),
      seed: z.number().int().optional().describe('Only with a composition plan'),
      category: z.string().min(1).max(40).optional().describe(CATEGORY_HINT_MUSIC),
      tags: z.array(z.string().min(1)).max(20).optional().describe(TAGS_HINT),
      force: z.boolean().optional().describe(FORCE_HINT),
    },
    async (args) => {
      emitTool(ctx, 'generate_music', (args.prompt ?? 'composition plan').slice(0, 60));
      if (!args.prompt && !args.compositionPlan) {
        return text('generate_music needs a prompt or a compositionPlan.', true);
      }
      // E3: the same library check; a composition plan is a precise score — nothing to match.
      if (!args.force && args.prompt && !args.compositionPlan) {
        const reuse = await libraryReuseAnswer('generate_music', args.prompt, {
          soundClass: 'music',
          ...(args.durationSeconds !== undefined ? { minDurationSec: args.durationSeconds } : {}),
        });
        if (reuse) return text(reuse.text);
      }
      return generateAndImport(
        ctx,
        'generate_music',
        {
          kind: 'music',
          ...(args.prompt ? { prompt: args.prompt } : {}),
          ...(args.durationSeconds !== undefined ? { durationSec: args.durationSeconds } : {}),
          instrumental: args.instrumental ?? true,
          ...(args.compositionPlan ? { compositionPlan: args.compositionPlan as AudioCompositionPlan } : {}),
          ...(args.seed !== undefined ? { seed: args.seed } : {}),
          ...(args.category !== undefined ? { category: args.category } : {}),
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
        },
        'place it with insert_asset (lane "audio", at: 0 for a bed under the whole edit, gain 0.2–0.35 so speech stays on top).',
      );
    },
  );

  return [generateSfx, generateMusic];
}
