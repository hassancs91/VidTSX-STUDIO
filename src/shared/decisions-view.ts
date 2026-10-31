// The Settings › General "Decisions" row's view model (DECISION_MODELS_DESIGN.md §8). Pure, over the `decisions:status` view only —
// has-key booleans, never a key; plain words, never a probability.

import type { DecisionsHostedRungStatus, DecisionsStatus } from './ipc/types/decisions';
import { DEFAULT_DECISIONS_HOSTED_ORDER, type HostedDecisionProviderId } from './types/decisions';

/** The short names §8's dots use ("Jev — key set · OpenRouter — key set"). */
export const HOSTED_RUNG_SHORT_NAMES: Record<HostedDecisionProviderId, string> = {
  jev: 'Jev',
  'openrouter-decisions': 'OpenRouter',
};

/** The AI → Providers row that holds each rung's key. */
export const HOSTED_RUNG_KEY_ROWS: Record<HostedDecisionProviderId, string> = {
  jev: 'TypeSafe',
  'openrouter-decisions': 'OpenRouter',
};

export interface HostedRungView {
  id: HostedDecisionProviderId;
  label: string;
  /** 1-based place in the order; null when switched off. */
  position: number | null;
  enabled: boolean;
  hasKey: boolean;
  available: boolean;
  /** 'ready', or why not, in plain words. */
  stateText: string;
}

const rungOf = (status: DecisionsStatus, id: HostedDecisionProviderId): DecisionsHostedRungStatus => status[id];

/** The enabled rungs in the stored order, then the switched-off ones in the default order. */
export function hostedRungViews(status: DecisionsStatus): HostedRungView[] {
  const order = status.hostedOrder.filter((id, i, all) => all.indexOf(id) === i);
  const off = DEFAULT_DECISIONS_HOSTED_ORDER.filter((id) => !order.includes(id));
  return [...order, ...off].map((id) => {
    const rung = rungOf(status, id);
    const position = order.indexOf(id);
    return {
      id,
      label: HOSTED_RUNG_SHORT_NAMES[id],
      position: position >= 0 ? position + 1 : null,
      enabled: position >= 0,
      hasKey: rung.hasKey,
      available: rung.available,
      stateText: rung.available ? 'ready' : (rung.why ?? 'unavailable'),
    };
  });
}

/** A rung's line in the order: "key set · ready", "no key · switched off" — or just "no key" when that is the only reason. */
export function rungLineText(view: HostedRungView): string {
  const key = view.hasKey ? 'key set' : 'no key';
  if (!view.enabled) return `${key} · switched off`;
  return !view.hasKey && view.stateText === 'no key' ? key : `${key} · ${view.stateText}`;
}

/** "Jev — key set · OpenRouter — no key", in the views order. */
export function keyDotsText(status: DecisionsStatus): string {
  return hostedRungViews(status)
    .map((v) => `${v.label} — ${v.hasKey ? 'key set' : 'no key'}`)
    .join(' · ');
}

/** Move a rung one place up (-1) or down (+1); a rung not in the order, or at an end, stays. Never mutates. */
export function moveHostedRung(
  order: readonly HostedDecisionProviderId[],
  id: HostedDecisionProviderId,
  delta: -1 | 1,
): HostedDecisionProviderId[] {
  const next = [...order];
  const from = next.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Switch a rung off (an empty order is allowed — `auto` then has no hosted rung). Never mutates. */
export function removeHostedRung(order: readonly HostedDecisionProviderId[], id: HostedDecisionProviderId): HostedDecisionProviderId[] {
  return order.filter((x) => x !== id);
}

/** Switch a rung back on, at the end of the order. Never mutates. */
export function addHostedRung(order: readonly HostedDecisionProviderId[], id: HostedDecisionProviderId): HostedDecisionProviderId[] {
  return order.includes(id) ? [...order] : [...order, id];
}

/** The local rung: none ships in this slice (D3 failed), so no Download button. */
export function localRungText(status: DecisionsStatus): string {
  return status.local.state === 'none' ? 'none available' : 'unknown'; // only 'none' exists in this slice
}

/** What answers right now, in plain words — no number. */
export function decisionsNowText(status: DecisionsStatus): string {
  if (status.mode === 'off') return 'Off — every decision request is refused without a network call';
  const first = hostedRungViews(status).find((v) => v.enabled && v.available);
  if (first) return `Answers come from ${first.label}`;
  if (status.llm.available) {
    return 'No hosted provider is ready — only callers that accept an uncalibrated answer get one (your AI provider)';
  }
  return 'No provider is ready — add a TypeSafe or OpenRouter key in AI → Providers';
}

/** The OpenRouter model id as typed: trimmed; blank or with inner whitespace → null (main validates the rest). */
export function normalizeOpenRouterModel(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return trimmed;
}
