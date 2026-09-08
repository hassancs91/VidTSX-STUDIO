// Turning what the user clicked into `InteractionReply.values` — the pure half
// of the three cards (agents plan §1.5, §7).
//
// It lives apart from the components because this is the half that DECIDES
// WHAT THE MODEL READS. The broker renders these entries as `key: value` into
// the fixed `[Answer to question <id>] …` message, so the key carries the id
// the model chose and the value the words the user actually saw. Getting that
// wrong is a silent failure — the agent answers a question nobody asked — and
// the renderer has no component test rig, so keeping it here is what makes it
// checkable at all.

import type { InteractionCandidate, InteractionFormField } from '../../../shared/types/agents';
import type { InteractionValues } from './types';

/** `pick`: one entry per chosen candidate, keyed by its own id. */
export function pickValues(
  candidates: readonly InteractionCandidate[],
  chosenIds: readonly string[],
): InteractionValues {
  const values: InteractionValues = {};
  for (const id of chosenIds) {
    const candidate = candidates.find((c) => c.id === id);
    if (candidate) values[candidate.id] = [candidate.label];
  }
  return values;
}

/** `approve`: one entry per item, the verdict plus the label it applies to. */
export function approveValues(
  items: readonly InteractionCandidate[],
  verdicts: Readonly<Record<string, 'approved' | 'rejected'>>,
): InteractionValues {
  const values: InteractionValues = {};
  for (const item of items) {
    const verdict = verdicts[item.id];
    if (verdict) values[item.id] = [`${verdict} (${item.label})`];
  }
  return values;
}

/**
 * `form`: one entry per ANSWERED field. A skipped optional field is left out
 * rather than sent empty — the model reads "not answered" from its absence,
 * where an empty string would read as a deliberate blank answer.
 */
export function formValues(
  fields: readonly InteractionFormField[],
  draft: Readonly<Record<string, string>>,
): InteractionValues {
  const values: InteractionValues = {};
  for (const field of fields) {
    const value = (draft[field.id] ?? '').trim();
    if (value.length > 0) values[field.id] = [value];
  }
  return values;
}

/** Required fields the draft has not answered yet — the Send gate. */
export function missingRequiredFields(
  fields: readonly InteractionFormField[],
  draft: Readonly<Record<string, string>>,
): InteractionFormField[] {
  return fields.filter((f) => f.required && (draft[f.id] ?? '').trim().length === 0);
}
