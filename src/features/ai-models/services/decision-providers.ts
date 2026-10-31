// The AI → Providers "Decisions" section (DECISION_MODELS_DESIGN.md §8, §15.3 2) and the TypeSafe row's key test (rulings D-r19 (3),
// D-r20). Pure. The test rides `decisions:decide` `{ test: 'jev' }` and tests the SAVED key — a typed, unsaved key is never sent, so the
// button stays disabled until the key is saved; its result reads as the other rows' do (plain words, no probability).

import type { DecisionsDecideResponse } from '@shared/ipc/types';
import type { ProviderDefinition } from '@shared/providers/registry';

/** A provider whose only capability is `decision` (TypeSafe): its key row lives in the Decisions section, not the API keys table. */
export function isDecisionOnlyProvider(row: ProviderDefinition): boolean {
  return row.capabilities.length > 0 && row.capabilities.every((cap) => cap === 'decision');
}

/** Key rows (decision-only providers) and listed rows (providers that also power decisions but keep their key row in API keys). */
export function decisionSectionRows(rows: readonly ProviderDefinition[]): {
  keyRows: ProviderDefinition[];
  listedRows: ProviderDefinition[];
} {
  const deciders = rows.filter((row) => row.capabilities.includes('decision'));
  return {
    keyRows: deciders.filter(isDecisionOnlyProvider),
    listedRows: deciders.filter((row) => !isDecisionOnlyProvider(row)),
  };
}

export const DECISION_TEST_TITLES = {
  ready: 'Sends one tiny yes / no question to Jev with the saved TypeSafe key',
  noKey: 'Save a TypeSafe key first — the test uses the saved key',
  unsaved: 'Save the typed key first — the test uses the saved TypeSafe key, never a typed one',
  clearing: 'This key is removed on save — nothing to test',
} as const;

export function decisionKeyTestGate(input: { saved: boolean; draft: string; clearing: boolean }): { disabled: boolean; title: string } {
  if (input.clearing) return { disabled: true, title: DECISION_TEST_TITLES.clearing };
  if (input.draft.trim()) return { disabled: true, title: DECISION_TEST_TITLES.unsaved };
  if (!input.saved) return { disabled: true, title: DECISION_TEST_TITLES.noKey };
  return { disabled: false, title: DECISION_TEST_TITLES.ready };
}

export interface DecisionKeyTestResult {
  testing: false;
  success: boolean;
  durationMs?: number;
  error?: string;
}

/** The key test's answer → the row's result line: "Connected (N ms)" or a plain sentence. The answer's probability is never read. */
export function decisionTestResult(response: DecisionsDecideResponse): DecisionKeyTestResult {
  if (response.ok) return { testing: false, success: true, durationMs: Math.round(response.result.latencyMs) };
  const { code, message } = response.error;
  if (code === 'no-provider') return { testing: false, success: false, error: 'No saved TypeSafe key, or Decisions are off in Settings' };
  if (code === 'timeout') return { testing: false, success: false, error: 'Jev did not answer in time' };
  return { testing: false, success: false, error: message || 'The test failed' };
}
