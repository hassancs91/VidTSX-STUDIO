// Decisions IPC (DECISION_MODELS_DESIGN.md §12). The decision contract lives in `shared/types/decisions.ts`; these are the wire envelopes and
// the status view. NO KEY ever crosses: the status carries has-key BOOLEANS only (§8); no event carries a key or a state text. The TypeSafe
// key row's test sends `{ test: 'jev' }` — it tests the SAVED key, main-side, so no key rides on a decisions request either.

import type {
  DecisionErrorCode,
  DecisionRequest,
  DecisionResult,
  DecisionsMode,
  HostedDecisionProviderId,
} from '../../types/decisions';

/** `decisions:decide` — a request (the dev-preview tester, the canvas preview) or the TypeSafe row's key test (one tiny noul pinned to `jev`). */
export type DecisionsDecideRequest = { request: DecisionRequest } | { test: 'jev' };

/** A typed failure; the message is scrubbed of any key and of the state text (§3). */
export interface DecisionsWireError {
  code: DecisionErrorCode;
  message: string;
}

/** A failure is typed, never a rejected invoke. */
export type DecisionsDecideResponse = { ok: true; result: DecisionResult } | { ok: false; error: DecisionsWireError };

/** One hosted rung in the status view (§8 / §12): has-key as a boolean, never the key. */
export interface DecisionsHostedRungStatus {
  id: HostedDecisionProviderId;
  name: string;
  /** The model it requests (the served id comes back on each result). */
  model: string;
  /** The AI → Providers row that holds its key. */
  keyProvider: 'typesafe' | 'openrouter';
  hasKey: boolean;
  /** In `decisionsHostedOrder` (the user can switch any hosted rung off). */
  enabled: boolean;
  available: boolean;
  /** Why it is unavailable, in plain words. */
  why?: string;
}

/** `decisions:status` — the mode, the hosted order with has-key booleans, each rung's `available`, the local rung state (none in slice 1). */
export interface DecisionsStatus {
  mode: DecisionsMode;
  hostedOrder: HostedDecisionProviderId[];
  openRouterModel: string;
  jev: DecisionsHostedRungStatus;
  'openrouter-decisions': DecisionsHostedRungStatus;
  /** No local model ships in this slice (D3 failed). */
  local: { state: 'none'; available: false; why: string };
  /** The app's text provider answering JSON — uncalibrated, used by `auto` only with `allowUncalibrated`. */
  llm: { available: boolean; why?: string };
}

export type DecisionsStatusRequest = Record<string, never>;
/** On a failure every rung is unavailable and `error` says why. */
export interface DecisionsStatusResponse extends DecisionsStatus {
  error?: string;
}

/** `decisions:settings:set` — a field left out is left alone. */
export interface DecisionsSettingsSetRequest {
  mode?: DecisionsMode;
  hostedOrder?: HostedDecisionProviderId[];
  openRouterModel?: string;
}
/** The new status; a refused patch answers the unchanged status with `error`. */
export type DecisionsSettingsSetResponse = DecisionsStatusResponse;

/** `decisions:event` (push): the status after a rung became available / unavailable (a key change, a settings change). */
export type DecisionsEvent = { type: 'status'; status: DecisionsStatus };
