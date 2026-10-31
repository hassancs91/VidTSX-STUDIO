// Decisions IPC handlers (DECISION_MODELS_DESIGN.md §12). Every body is in try/catch and answers a typed value — an invoke never rejects.
// Registered with `lazily` (registrations/decisions.ts); the work is the runtime's (`decision-runtime.ts`). No key crosses: the key test
// (`{ test: 'jev' }`, ruling D-r19) sends only the rung id and main tests the SAVED key; every error message is masked of key shapes.

import type { IpcMainInvokeEvent } from 'electron';
import type { AiFeatureSource } from '../../shared/types/ai-usage';
import type { DecisionRequest, HostedDecisionProviderId } from '../../shared/types/decisions';
import { DEFAULT_DECISIONS_HOSTED_ORDER } from '../../shared/types/decisions';
import type {
  DecisionsDecideRequest,
  DecisionsDecideResponse,
  DecisionsHostedRungStatus,
  DecisionsSettingsSetRequest,
  DecisionsSettingsSetResponse,
  DecisionsStatusResponse,
  DecisionsWireError,
} from '../../shared/ipc/types/decisions';
import { DECISION_PROVIDER_PRESETS } from '../../decision-engine';
import { WHY_NO_LOCAL } from '../../decision-engine/ladder';
import { scrubDecisionText } from '../../decision-engine/scrub';
import { getDecisionRuntime, toDecisionsWireError } from '../services/decisions/decision-runtime';

/** The renderer's free-form callers: the dev-preview tester and the canvas preview (§12). The agent / routing sources are main's own. */
const RENDERER_FEATURE_SOURCES: readonly AiFeatureSource[] = ['decision-test', 'decision-flow'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Defence in depth: a message that slipped past the engine's scrub still never carries a bearer token or an `sk-…` key. */
function wireError(err: unknown): DecisionsWireError {
  const error = toDecisionsWireError(err);
  return { code: error.code, message: scrubDecisionText(error.message, []) };
}

const invalid = (message: string): DecisionsDecideResponse => ({ ok: false, error: { code: 'invalid-request', message } });

const messageOf = (err: unknown): string =>
  scrubDecisionText((err instanceof Error ? err.message : String(err)) || 'Decisions are unavailable.', []);

/** The status a failed status call answers: nothing known, every rung unavailable, plus the reason. */
function unavailableStatus(error: string): DecisionsStatusResponse {
  const rung = (id: HostedDecisionProviderId): DecisionsHostedRungStatus => {
    const preset = DECISION_PROVIDER_PRESETS.find((p) => p.id === id);
    return {
      id,
      name: preset?.name ?? id,
      model: preset?.model ?? '',
      keyProvider: id === 'jev' ? 'typesafe' : 'openrouter',
      hasKey: false,
      enabled: true,
      available: false,
      why: error,
    };
  };
  const openRouter = rung('openrouter-decisions');
  return {
    mode: 'auto',
    hostedOrder: [...DEFAULT_DECISIONS_HOSTED_ORDER],
    openRouterModel: openRouter.model,
    jev: rung('jev'),
    'openrouter-decisions': openRouter,
    local: { state: 'none', available: false, why: WHY_NO_LOCAL },
    llm: { available: false, why: error },
    error,
  };
}

export async function handleDecisionsDecide(_event: IpcMainInvokeEvent, req: DecisionsDecideRequest): Promise<DecisionsDecideResponse> {
  try {
    const envelope: unknown = req;
    if (!isObject(envelope)) return invalid('A decision needs { request } or { test: "jev" }.');
    // The key test: ONLY the rung id is read — any request, key or other field riding along is ignored (D-r19).
    if ('test' in envelope) {
      if (envelope.test !== 'jev') return invalid('Only the Jev key test exists.');
      return await getDecisionRuntime().testKey();
    }
    const request = envelope.request;
    if (!isObject(request)) return invalid('A decision needs { request } or { test: "jev" }.');
    if (!RENDERER_FEATURE_SOURCES.includes(request.featureSource as AiFeatureSource)) {
      return invalid('A decision from the app window logs as "decision-test" or "decision-flow".');
    }
    // The engine validates the request and works on its own clean copy.
    return { ok: true, result: await getDecisionRuntime().decide(request as unknown as DecisionRequest) };
  } catch (err) {
    return { ok: false, error: wireError(err) };
  }
}

export async function handleDecisionsStatus(): Promise<DecisionsStatusResponse> {
  try {
    return await getDecisionRuntime().status();
  } catch (err) {
    return unavailableStatus(messageOf(err));
  }
}

export async function handleDecisionsSettingsSet(
  _event: IpcMainInvokeEvent,
  req: DecisionsSettingsSetRequest,
): Promise<DecisionsSettingsSetResponse> {
  try {
    return await getDecisionRuntime().setSettings(req ?? {});
  } catch (err) {
    const error = messageOf(err);
    try {
      return { ...(await getDecisionRuntime().status()), error };
    } catch {
      return unavailableStatus(error);
    }
  }
}
