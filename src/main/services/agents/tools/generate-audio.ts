// `generate_audio` — sound effects and music through the audio generation
// engine (V1 completion plan §2.2 W2b), behind the shared tool contract.
//
// BLOCKING is correct: ElevenLabs answers a sound effect in seconds and a
// music track in well under a minute — inside the long-jobs envelope (§1.5),
// the same call the Studio agent's `generate_sfx` / `generate_music` make.
// The file is born-managed library content (origin `generated`, the prompt
// as its description, brand-tagged) and comes back as an `audio` artifact.

import { z } from 'zod';
import type { AudioCompositionPlan } from '../../../../audio-engine/generation';
import {
  generateAudioAsset,
  hasAudioProvider,
  NO_AUDIO_PROVIDER_MESSAGE,
} from '../../library/generate-audio-asset';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const KINDS = ['sfx', 'music'] as const;

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
  durationSeconds: z
    .number()
    .optional()
    .describe('Length in seconds. sfx: omit to let the model choose. music: prompt form only.'),
  loop: z.boolean().optional().describe('sfx: loop seamlessly (ambiences).'),
  promptInfluence: z.number().min(0).max(1).optional().describe('sfx: 0–1, how literally to follow the prompt.'),
  instrumental: z.boolean().optional().describe('music: guarantee no vocals (default true).'),
  compositionPlan: compositionPlanSchema.optional(),
  seed: z.number().int().optional().describe('music, with a composition plan only.'),
};

interface GenerateAudioArgs {
  kind: (typeof KINDS)[number];
  prompt?: string;
  durationSeconds?: number;
  loop?: boolean;
  promptInfluence?: number;
  instrumental?: boolean;
  compositionPlan?: AudioCompositionPlan;
  seed?: number;
}

export const generateAudioTool: AgentToolDef<GenerateAudioArgs> = {
  id: 'generate_audio',
  description:
    'Generate one sound effect or music track with the configured audio provider (ElevenLabs) and file it in the asset library under this session\'s folder. Takes seconds (sound effects about $0.002 per second of audio, music about $0.0025). Returns an "audio" artifact.',
  needs: 'audio-provider',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    if (!(await hasAudioProvider())) return toolText(NO_AUDIO_PROVIDER_MESSAGE, true);
    if (args.kind === 'music' && !args.prompt && !args.compositionPlan) {
      return toolText('Music needs a prompt or a compositionPlan.', true);
    }
    ctx.emitProgress((args.prompt ?? 'composition plan').slice(0, 60));
    try {
      const asset = await generateAudioAsset({
        kind: args.kind,
        ...(args.prompt ? { prompt: args.prompt } : {}),
        ...(args.durationSeconds !== undefined ? { durationSec: args.durationSeconds } : {}),
        ...(args.loop !== undefined ? { loop: args.loop } : {}),
        ...(args.promptInfluence !== undefined ? { promptInfluence: args.promptInfluence } : {}),
        ...(args.kind === 'music' ? { instrumental: args.instrumental ?? true } : {}),
        ...(args.compositionPlan ? { compositionPlan: args.compositionPlan } : {}),
        ...(args.seed !== undefined ? { seed: args.seed } : {}),
        featureSource: 'agent',
        agentId: ctx.agentId,
        ...(ctx.libraryFolder ? { folder: ctx.libraryFolder } : {}),
        ...(ctx.brandId ? { brandId: ctx.brandId } : {}),
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
