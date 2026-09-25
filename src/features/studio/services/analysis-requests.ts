// The analysis request state machine (docs/studio/FILTER_PACKS_DESIGN.md
// "As built (masks track)" → M4), pure: per (kind, asset) key, what the
// editor asks main for, what it cancels, and how a job event moves the
// state. `useAnalysisTracks` runs it; the tests pin it.
//
//   need appears ──request──▶ analyzing ──ready──▶ ready (guard dropped)
//                                 │  └──error──▶ error     (guard kept)
//                                 └──Cancel──▶ canceled    (guard kept)
//   need gone (last tracked filter removed) ─▶ cancel a live job, forget
//                                              state + guard; re-applying
//                                              asks again.
//
// The guard is the need's signature a request went out for: while it
// matches, the same need is never re-asked — after an error (a retry loop met
// live 2026-09-24) or a cancel (the user said stop). A CHANGED need (a trim
// past the padding) is a new request.

import type { StudioMediaJobEvent } from '@shared/ipc/types';
import { needKey, needSignature, stateCovers, type AnalysisKind, type AnalysisState, type TrackNeed } from './analysis-status';

export interface AnalysisRequestPlan {
  /** Queue these (and set their guard). */
  request: TrackNeed[];
  /** Jobs to stop: their need is gone while they may still run. */
  cancel: { kind: AnalysisKind; assetId: string }[];
  /** Keys whose state and guard are dropped (their need is gone). */
  forget: string[];
}

/** Splits a `needKey` back into its halves. */
export function parseNeedKey(key: string): { kind: AnalysisKind; assetId: string } {
  const bar = key.indexOf('|');
  return { kind: key.slice(0, bar) as AnalysisKind, assetId: key.slice(bar + 1) };
}

/**
 * What to do for the current needs. `canStart` holds a need back (a video
 * waits for its proxy to settle); a need already covered, being analysed, or
 * asked for with the same signature (in flight, failed or canceled) waits.
 */
export function planAnalysisRequests(
  needs: ReadonlyMap<string, TrackNeed>,
  states: ReadonlyMap<string, AnalysisState>,
  guards: ReadonlyMap<string, string>,
  canStart: (need: TrackNeed) => boolean,
): AnalysisRequestPlan {
  const plan: AnalysisRequestPlan = { request: [], cancel: [], forget: [] };
  for (const key of new Set([...states.keys(), ...guards.keys()])) {
    if (needs.has(key)) continue;
    plan.forget.push(key);
    const state = states.get(key);
    const settled = state?.status === 'ready' || state?.status === 'error' || state?.status === 'canceled';
    if (guards.has(key) && !settled) plan.cancel.push(parseNeedKey(key));
  }
  for (const [key, need] of needs) {
    if (!canStart(need)) continue;
    const state = states.get(key);
    if (stateCovers(state, need) || state?.status === 'analyzing') continue;
    if (guards.get(key) === needSignature(need)) continue;
    plan.request.push(need);
  }
  return plan;
}

/**
 * A job event's effect on its key: the next state (null = drop it) and
 * whether the request guard stays. `guarded` = a request for the key is
 * still wanted (its need exists); a cancel whose need is already gone just
 * drops the state.
 */
export function nextAnalysisState(event: StudioMediaJobEvent, guarded: boolean): { state: AnalysisState | null; keepGuard: boolean } {
  switch (event.status) {
    case 'generating':
      return { state: { status: 'analyzing', percent: event.percent ?? 0, ...(event.message ? { message: event.message } : {}) }, keepGuard: true };
    case 'ready':
      return event.analysis
        ? { state: { status: 'ready', spans: event.analysis.spans, fps: event.analysis.fps, ep: event.analysis.ep }, keepGuard: false }
        : { state: null, keepGuard: false };
    case 'error':
      return { state: { status: 'error', error: event.error ?? 'unknown error' }, keepGuard: true };
    case 'canceled':
      return guarded ? { state: { status: 'canceled' }, keepGuard: true } : { state: null, keepGuard: false };
  }
}

/** The key an event belongs to. */
export const eventKey = (event: Pick<StudioMediaJobEvent, 'kind' | 'assetId'>): string => needKey(event.kind as AnalysisKind, event.assetId);
