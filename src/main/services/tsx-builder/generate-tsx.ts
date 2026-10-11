// generateTsx(): the one entry every TSX caller goes through
// (TSX_BUILDER_DESIGN.md T1). A provider that can run tools gets the builder
// (design, build, look, redesign); every other provider gets today's one-shot
// pipeline with the caller's own gate (pipeline-fallback.ts). 3D always takes
// the pipeline: the builder makes 2D only. "Can run tools" is the agents'
// rule, `resolveToolSupport`: an `agent-sdk` provider.

import { resolveToolSupport } from '../agents/tool-support';
import { logEngine } from '../../../logging/log-engine';
import { buildComposition } from './tsx-builder';
import { runPipelineFallback } from './pipeline-fallback';
import type { PipelineMode } from '../../../shared/tsx-engine';
import type { GenerateTsxRequest, GenerateTsxResult, TsxEngine, TsxEngineChoice } from './types';

const log = logEngine.createLogger('TsxDispatch');

/** In order: a forced engine, then 3D, then the provider's tool support. */
export async function chooseTsxEngine(input: {
  providerId?: string;
  mode?: PipelineMode;
  engine?: TsxEngine;
}): Promise<TsxEngineChoice> {
  if (input.engine) return { engine: input.engine, reason: 'forced' };
  if (input.mode === '3d') return { engine: 'pipeline', reason: 'mode-3d' };
  return (await resolveToolSupport(input.providerId))
    ? { engine: 'builder', reason: 'tools' }
    : { engine: 'pipeline', reason: 'no-tools' };
}

export async function generateTsx(req: GenerateTsxRequest): Promise<GenerateTsxResult> {
  const started = Date.now();
  const choice = await chooseTsxEngine(req);
  log.info('TSX engine chosen', {
    engine: choice.engine,
    reason: choice.reason,
    providerId: req.providerId ?? 'active',
    edit: Boolean(req.editOf),
  });
  if (choice.engine === 'pipeline') return runPipelineFallback(req, choice.reason, started);

  const { engine: _engine, mode: _mode, fallback: _fallback, ...buildRequest } = req;
  try {
    const build = await buildComposition(buildRequest);
    return {
      engine: 'builder',
      reason: choice.reason,
      ok: build.ok,
      stopReason: build.stopReason,
      ...(build.ok && build.code ? { code: build.code } : {}),
      ...(build.ok && build.config ? { config: build.config } : {}),
      ...(build.error ? { error: build.error } : {}),
      elapsedMs: build.elapsedMs,
      build,
    };
  } catch (err) {
    log.error('Builder run threw', err);
    return {
      engine: 'builder',
      reason: choice.reason,
      ok: false,
      stopReason: req.signal?.aborted ? 'cancelled' : 'error',
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}
