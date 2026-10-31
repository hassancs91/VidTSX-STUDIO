// The decisions settings in the KV store (DECISION_MODELS_DESIGN.md §8; the `library-search/search-settings.ts` pattern):
// `decisionsMode` auto | off (unset = auto), `decisionsHostedOrder` (unset = ['jev', 'openrouter-decisions']; any rung removable, an empty
// order is stored), `decisionsOpenRouterModel` (unset = microsoft/microsoft-decision-1). A stored value that is not ours reads as the
// default (never trusted). `decisionsLocalModelId` is not written: no local model ships in this slice (D3 failed).

import {
  DEFAULT_DECISIONS_HOSTED_ORDER,
  type DecisionsMode,
  type HostedDecisionProviderId,
} from '../../../shared/types/decisions';
import type { DecisionsSettingsSetRequest } from '../../../shared/ipc/types/decisions';
import { getValue, setValue } from '../settings-db';

export const DEFAULT_DECISIONS_OPENROUTER_MODEL = 'microsoft/microsoft-decision-1';
const MODE_KEY = 'decisionsMode';
const ORDER_KEY = 'decisionsHostedOrder';
const MODEL_KEY = 'decisionsOpenRouterModel';
const MODES: readonly DecisionsMode[] = ['auto', 'off'];

export interface DecisionSettings {
  mode: DecisionsMode;
  hostedOrder: HostedDecisionProviderId[];
  openRouterModel: string;
}

const isMode = (v: unknown): v is DecisionsMode => typeof v === 'string' && (MODES as readonly string[]).includes(v);
const isHosted = (v: unknown): v is HostedDecisionProviderId =>
  typeof v === 'string' && (DEFAULT_DECISIONS_HOSTED_ORDER as readonly string[]).includes(v);

/** A stored order: known hosted ids only, first occurrence wins; not an array → the default. */
function readOrder(value: unknown): HostedDecisionProviderId[] {
  if (!Array.isArray(value)) return [...DEFAULT_DECISIONS_HOSTED_ORDER];
  const out: HostedDecisionProviderId[] = [];
  for (const id of value) if (isHosted(id) && !out.includes(id)) out.push(id);
  return out;
}

const sameOrder = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export function getDecisionSettings(): DecisionSettings {
  const mode = getValue<unknown>(MODE_KEY);
  const model = getValue<unknown>(MODEL_KEY);
  return {
    mode: isMode(mode) ? mode : 'auto',
    hostedOrder: readOrder(getValue<unknown>(ORDER_KEY)),
    openRouterModel: typeof model === 'string' && model.trim() ? model : DEFAULT_DECISIONS_OPENROUTER_MODEL,
  };
}

/** Validates the whole patch before writing anything; a default is stored as unset; a field left out is left alone. */
export function setDecisionSettings(patch: DecisionsSettingsSetRequest): DecisionSettings {
  if (patch.mode !== undefined && !isMode(patch.mode)) throw new Error(`Unknown decisions mode: ${String(patch.mode)}`);
  if (patch.hostedOrder !== undefined) {
    if (!Array.isArray(patch.hostedOrder)) throw new Error('The decisions hosted order must be a list');
    const order: readonly unknown[] = patch.hostedOrder;
    for (const id of order) if (!isHosted(id)) throw new Error(`Unknown hosted decision provider: ${String(id)}`);
    if (new Set(order).size !== order.length) throw new Error('A hosted decision provider is listed twice');
  }
  if (patch.openRouterModel !== undefined && (typeof patch.openRouterModel !== 'string' || !patch.openRouterModel.trim())) {
    throw new Error('The OpenRouter decisions model id is empty');
  }
  if (patch.mode !== undefined) setValue(MODE_KEY, patch.mode === 'auto' ? undefined : patch.mode);
  if (patch.hostedOrder !== undefined) {
    setValue(ORDER_KEY, sameOrder(patch.hostedOrder, DEFAULT_DECISIONS_HOSTED_ORDER) ? undefined : [...patch.hostedOrder]);
  }
  if (patch.openRouterModel !== undefined) {
    const model = patch.openRouterModel.trim();
    setValue(MODEL_KEY, model === DEFAULT_DECISIONS_OPENROUTER_MODEL ? undefined : model);
  }
  return getDecisionSettings();
}
