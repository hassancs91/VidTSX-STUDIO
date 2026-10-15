// The one-shot fallback behind generateTsx() (TSX_BUILDER_DESIGN.md T1): a
// builder request run through today's pipeline, for providers that cannot use
// tools and for 3D. The request maps over mechanically — intent, format,
// brand, a loop line, reference images, `editOf` → editTsxPipeline on that
// version's single file. What only the builder can use (packs, budget, caps)
// is dropped. Nothing is saved here: the caller saves the code as it does
// today, through its own gate (`fallback.deps`).

import fs from 'fs/promises';
import {
  generateTsxPipeline,
  editTsxPipeline,
  type TsxEditPipelineOptions,
  type TsxPipelineOptions,
} from '../../../shared/tsx-engine';
import { parseCompositionConfig } from '../composition-config-parser';
import { resolveEditVersion } from './build-seed';
import type { GenerateTsxResult, PipelineBoundRequest, TsxEngineReason } from './types';

/** The pipeline has no loop notion; this line is all it gets of `format.loop`. */
export const LOOP_INSTRUCTION =
  'Seamless loop: the last frame must flow into frame 0 with no jump — every moving thing ends exactly where it started.';

type PipelineResult = Extract<GenerateTsxResult, { engine: 'pipeline' }>;

/** The settings both pipeline entries share, from the caller's fallback block. */
function sharedOptions(req: PipelineBoundRequest) {
  const { fallback } = req;
  return {
    ...(req.providerId ? { providerId: req.providerId } : {}),
    ...(req.model ? { model: req.model } : {}),
    ...(req.referenceImages?.length ? { images: req.referenceImages } : {}),
    ...(fallback.thinkingLevel ? { thinkingLevel: fallback.thinkingLevel } : {}),
    ...(fallback.maxTurns !== undefined ? { maxTurns: fallback.maxTurns } : {}),
    ...(fallback.maxFixRetries !== undefined ? { maxFixRetries: fallback.maxFixRetries } : {}),
    ...(fallback.onProgress ? { onProgress: fallback.onProgress } : {}),
  };
}

/** A new piece: the request's format, brand and loop become the pipeline's prompt context. */
export function pipelineOptionsFor(req: PipelineBoundRequest): TsxPipelineOptions {
  const { format, fallback } = req;
  const extraInstructions = [
    req.brand?.trim(),
    format?.loop ? LOOP_INSTRUCTION : undefined,
    fallback.promptContext?.extraInstructions?.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
  const { extraInstructions: _callerExtra, ...callerContext } = fallback.promptContext ?? {};
  return {
    prompt: req.intent,
    promptContext: {
      ...callerContext,
      ...(format ? { videoWidth: format.width, videoHeight: format.height, fps: format.fps } : {}),
      // Absent = the length is the model's call, like the Creator's auto duration.
      ...(format?.durationInFrames ? { durationSeconds: format.durationInFrames / format.fps } : {}),
      ...(extraInstructions ? { extraInstructions } : {}),
    },
    ...(req.mode ? { mode: req.mode } : {}),
    ...(fallback.optimize !== undefined ? { optimize: fallback.optimize } : {}),
    ...sharedOptions(req),
  };
}

/** An edit: the change wanted, applied to the version's single file (a builder version's bundle included). */
export function editOptionsFor(req: PipelineBoundRequest, currentCode: string): TsxEditPipelineOptions {
  return {
    currentCode,
    editInstruction: req.intent,
    ...(req.fallback.chatHistory?.length ? { chatHistory: req.fallback.chatHistory } : {}),
    ...sharedOptions(req),
  };
}

export async function runPipelineFallback(
  req: PipelineBoundRequest,
  reason: TsxEngineReason,
  started: number,
): Promise<PipelineResult> {
  const end = (fields: Omit<PipelineResult, 'engine' | 'reason' | 'elapsedMs'>): PipelineResult => ({
    engine: 'pipeline',
    reason,
    ...fields,
    elapsedMs: Date.now() - started,
  });
  const cancelled = () => end({ ok: false, stopReason: 'cancelled', error: 'Cancelled' });

  if (req.signal?.aborted) return cancelled();
  try {
    const pipeline = req.editOf
      ? await editTsxPipeline(
          editOptionsFor(req, await fs.readFile((await resolveEditVersion(req.editOf)).tsxPath, 'utf-8')),
          req.fallback.deps,
        )
      : await generateTsxPipeline(pipelineOptionsFor(req), req.fallback.deps);
    if (req.signal?.aborted) return cancelled();
    if (!pipeline.transpileValid) {
      return end({
        ok: false,
        stopReason: 'error',
        error: `The code did not pass the acceptance gate after ${pipeline.fixAttempts} fix attempt(s).`,
        pipeline,
      });
    }
    const config = parseCompositionConfig(pipeline.text);
    return end({
      ok: true,
      stopReason: 'finished',
      code: pipeline.text,
      ...(config ? { config } : {}),
      pipeline,
    });
  } catch (err) {
    if (req.signal?.aborted) return cancelled();
    return end({ ok: false, stopReason: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}
