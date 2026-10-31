// The renderer's three Decisions calls over the preload API (DECISION_MODELS_DESIGN.md §8 / §12), with the API injected so they are
// unit-testable. Pure of React; never throws — a rejected invoke becomes a plain sentence (its text is never shown: it could carry anything).
// No key is ever sent or read: the status carries has-key booleans only, and the tester sends `{ request }` with `featureSource:
// 'decision-test'` (D-r20 (1)) built by `decisions-tester-form.ts`.

import type {
  DecisionsDecideRequest,
  DecisionsDecideResponse,
  DecisionsSettingsSetRequest,
  DecisionsSettingsSetResponse,
  DecisionsStatusResponse,
} from './ipc/types/decisions';
import { buildTesterRequest, testerResultView, type DecisionsTesterForm, type TesterResultView } from './decisions-tester-form';

/** The structural slice of `window.api` these calls use (three of the preload's four decisions functions). */
export interface DecisionsClientApi {
  decisionsStatus: () => Promise<DecisionsStatusResponse>;
  decisionsSettingsSet: (data: DecisionsSettingsSetRequest) => Promise<DecisionsSettingsSetResponse>;
  decisionsDecide: (data: DecisionsDecideRequest) => Promise<DecisionsDecideResponse>;
}

export interface DecisionsStatusRead {
  status: DecisionsStatusResponse | null;
  error: string | null;
}

export async function loadDecisionsStatus(api: Pick<DecisionsClientApi, 'decisionsStatus'>): Promise<DecisionsStatusRead> {
  try {
    const status = await api.decisionsStatus();
    return { status, error: status.error ?? null };
  } catch {
    return { status: null, error: 'Could not read the Decisions status' };
  }
}

/** Sends exactly the patch; a refused patch answers the unchanged status with `error` (main validates the whole patch first). */
export async function applyDecisionsPatch(
  api: Pick<DecisionsClientApi, 'decisionsSettingsSet'>,
  patch: DecisionsSettingsSetRequest,
): Promise<DecisionsStatusRead> {
  try {
    const status = await api.decisionsSettingsSet(patch);
    return { status, error: status.error ?? null };
  } catch {
    return { status: null, error: 'Could not save the Decisions setting' };
  }
}

export type TesterRun = { kind: 'form'; reason: string } | { kind: 'result'; view: TesterResultView };

/** The dev-preview tester: form → `{ request }` → the result view (the one place probabilities show, as numbers). */
export async function runDecisionsTester(api: Pick<DecisionsClientApi, 'decisionsDecide'>, form: DecisionsTesterForm): Promise<TesterRun> {
  const built = buildTesterRequest(form);
  if (!built.ok) return { kind: 'form', reason: built.reason };
  try {
    const response = await api.decisionsDecide({ request: built.request });
    return { kind: 'result', view: testerResultView(response) };
  } catch {
    return { kind: 'form', reason: 'The request failed before an answer came back' };
  }
}
