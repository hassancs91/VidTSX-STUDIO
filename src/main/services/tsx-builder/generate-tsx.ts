// generateTsx(): the one entry every TSX caller goes through
// (TSX_BUILDER_DESIGN.md T1, Rev 2). The builder is the only generator: a
// provider that can run tools gets it (design, build, look, redesign); a
// provider that cannot is refused with a clear message, not handed a second
// path. The one-shot pipeline is frozen and reachable only when a caller
// forces it or asks for 3D (Creator 3D until P2 gives the builder three.js).
// "Can run tools" is the agents' rule, `resolveToolSupport`: an `agent-sdk`
// provider. Through OpenRouter the model itself is checked first
// (openrouter-model-check.ts): the builder needs tool use and image input.

import { resolveProviderInfo, resolveToolSupport } from '../agents/tool-support';
import { logEngine } from '../../../logging/log-engine';
import { buildComposition } from './tsx-builder';
import { runPipelineFallback } from './pipeline-fallback';
import { checkBuilderModel } from './openrouter-model-check';
import type { PipelineMode } from '../../../shared/tsx-engine';
import type { GenerateTsxRequest, GenerateTsxResult, TsxEngine, TsxEngineChoice } from './types';

const log = logEngine.createLogger('TsxDispatch');

export const NEEDS_TOOLS_MESSAGE = 'TSX generation needs Claude or OpenRouter';

/** The refusal for a provider that cannot run tools, naming it when the app knows it. */
async function noToolsMessage(providerId?: string): Promise<string> {
  try {
    const info = await resolveProviderInfo(providerId);
    if (!info) return `${NEEDS_TOOLS_MESSAGE}: no LLM provider is set up.`;
    return `${NEEDS_TOOLS_MESSAGE}: provider "${info.id}"${info.type ? ` (${info.type})` : ''} cannot run tools.`;
  } catch {
    return `${NEEDS_TOOLS_MESSAGE}: provider "${providerId ?? 'active'}" cannot run tools.`;
  }
}

/** In order: a forced engine, then 3D, then the provider's tool support (none = refused). */
export async function chooseTsxEngine(input: {
  providerId?: string;
  mode?: PipelineMode;
  engine?: TsxEngine;
}): Promise<TsxEngineChoice> {
  if (input.engine) return { engine: input.engine, reason: 'forced' };
  if (input.mode === '3d') return { engine: 'pipeline', reason: 'mode-3d' };
  if (await resolveToolSupport(input.providerId)) return { engine: 'builder', reason: 'tools' };
  return { engine: 'none', reason: 'no-tools', error: await noToolsMessage(input.providerId) };
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
  const refused = (reason: 'no-tools' | 'unfit-model', error: string): GenerateTsxResult => ({
    engine: 'none',
    reason,
    ok: false,
    stopReason: 'error',
    error,
    elapsedMs: Date.now() - started,
  });
  if (choice.engine === 'none') return refused(choice.reason, choice.error);

  if (choice.engine === 'pipeline') {
    if (!req.fallback) {
      return {
        engine: 'pipeline',
        reason: choice.reason,
        ok: false,
        stopReason: 'error',
        error: 'The one-shot pipeline needs the caller\'s fallback deps (gate and usage attribution); none were given.',
        elapsedMs: Date.now() - started,
      };
    }
    return runPipelineFallback({ ...req, fallback: req.fallback }, choice.reason, started);
  }

  const gate = await checkBuilderModel(req.providerId, req.model, { signal: req.signal });
  if (!gate.ok) return refused('unfit-model', gate.error);
  if (gate.unchecked) log.warn('Builder model not checked', { reason: gate.unchecked, providerId: req.providerId ?? 'active' });

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
