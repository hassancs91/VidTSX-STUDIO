// generateTsx(): the one entry every TSX caller goes through
// (TSX_BUILDER_DESIGN.md T1, Rev 2). The builder is the only generator: a
// provider that can run tools gets it (design, build, look, redesign); a
// provider that cannot is refused with a clear message, not handed a second
// path (the one-shot pipeline was deleted in P3 part 8).
// "Can run tools" is the agents' rule, `resolveToolSupport`: an `agent-sdk`
// provider. Through OpenRouter the model itself is checked first
// (openrouter-model-check.ts): the builder needs tool use and image input.

import { resolveProviderInfo, resolveToolSupport } from '../agents/tool-support';
import { logEngine } from '../../../logging/log-engine';
import { buildComposition } from './tsx-builder';
import { checkBuilderModel } from './openrouter-model-check';
import type { GenerateTsxRequest, GenerateTsxResult, TsxEngineChoice } from './types';

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

/** The builder when the provider can run tools; otherwise refused. */
export async function chooseTsxEngine(input: { providerId?: string }): Promise<TsxEngineChoice> {
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

  const gate = await checkBuilderModel(req.providerId, req.model, { signal: req.signal });
  if (!gate.ok) return refused('unfit-model', gate.error);
  if (gate.unchecked) log.warn('Builder model not checked', { reason: gate.unchecked, providerId: req.providerId ?? 'active' });

  try {
    const build = await buildComposition(req);
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
