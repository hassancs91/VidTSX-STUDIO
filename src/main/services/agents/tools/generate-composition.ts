// `generate_composition` — a Remotion TSX composition through the full
// generation pipeline (agents plan §1.3 wave 1).
//
// BLOCKING is correct here (§1.5): the tool IS an LLM call, exactly as Studio's
// `generate_tsx_shot` is, and the long-jobs rule covers work that is not.
// Minutes, not seconds — the model should say what it is making before calling.

import { z } from 'zod';
import { generateTsxPipeline } from '../../../../shared/tsx-engine';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { buildAgentTsxDeps } from '../tsx-deps';
import { storeComposition } from './composition-file';

const schema = {
  title: z.string().min(1).describe('Short name for this composition — names the file.'),
  brief: z
    .string()
    .min(1)
    .describe('What the composition should show and do, concretely: content, motion, timing.'),
  width: z.number().int().positive().optional().describe('Pixels. Default 1920.'),
  height: z.number().int().positive().optional().describe('Pixels. Default 1080.'),
  fps: z.number().int().positive().optional().describe('Default 30.'),
  durationSeconds: z.number().positive().optional().describe('Default 6.'),
  styleNotes: z
    .string()
    .optional()
    .describe('Extra art-direction the brief does not cover (palette, type, brand rules).'),
};

interface GenerateCompositionArgs {
  title: string;
  brief: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  styleNotes?: string;
}

export const generateCompositionTool: AgentToolDef<GenerateCompositionArgs> = {
  id: 'generate_composition',
  description:
    'Generate an animated Remotion TSX composition from a brief and show it on the stage. Takes a minute or more — say what you are about to make first. The code may import react, remotion and @vidtsx/kit only, in a single file. Returns a "composition" artifact you can edit or render.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.title);
    const deps = buildAgentTsxDeps(ctx.providerId, ctx.signal);
    try {
      const result = await generateTsxPipeline(
        {
          prompt: args.brief,
          ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
          promptContext: {
            videoWidth: args.width ?? 1920,
            videoHeight: args.height ?? 1080,
            fps: args.fps ?? 30,
            durationSeconds: args.durationSeconds ?? 6,
            ...(args.styleNotes ? { extraInstructions: args.styleNotes } : {}),
          },
          onProgress: (progress) => ctx.emitProgress(`${args.title}: ${progress.stepLabel}`),
        },
        deps,
      );
      if (!result.transpileValid) {
        return toolText(
          `The composition did not pass the acceptance gate after ${result.fixAttempts} fix attempt(s). Try a simpler brief.`,
          true,
        );
      }
      const stored = await storeComposition(ctx.workspaceDir, args.title, result.text);
      const { config } = stored.draft.payload;
      return {
        ...toolText(
          `Composition ready: ${stored.relPath} — ${config.width}x${config.height}, ${(config.durationInFrames / config.fps).toFixed(1)}s at ${config.fps}fps.`,
        ),
        artifact: stored.draft,
      };
    } catch (err) {
      return toolText(
        `Composition generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
