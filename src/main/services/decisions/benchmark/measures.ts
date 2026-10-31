/**
 * D1's measures, ported EXACTLY (D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\measures.cjs — its DEFINITIONS header is the spec):
 *   accuracy  noul: (pTrue ≥ 0.5) = label over questions (a missing answer is wrong); choice: the top option ∈ allowed, over rows.
 *             top option = the highest p; ties → the first in the row's option order (off-list keys after).
 *   Brier     noul: mean (pTrue − y)²; choice (top-label): mean (p_top − 1[top ∈ allowed])²; choice multiclass (a note):
 *             (Σ_{a ∈ allowed} p_a − 1)² + Σ_{k ∉ allowed} p_k². Over the ANSWERED only.
 *   ECE       10 equal-width bins (bin = min(9, floor(10·p + 1e-9))); Σ_b (n_b / N)·|mean p_b − freq_b|.
 *   selective at τ ∈ {0.5, 0.7, 0.9}: act when confidence ≥ τ (noul max(p, 1 − p); choice p_top).
 *   latency   nearest-rank quantiles sorted[ceil(p·n) − 1], per request and per question.
 * Pure: no Node, no electron.
 */
import type { BenchmarkRequestRecord, GroupMeasures, LatencySet, LatencySummary, ReliabilityBin, SelectiveRow } from './types';

const BINS = 10;
const TAUS = [0.5, 0.7, 0.9] as const;

export const binOf = (p: number): number => Math.min(BINS - 1, Math.max(0, Math.floor(p * BINS + 1e-9)));

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** items: { p, y } with y ∈ {0, 1} — p is the probability the bin is judged on, y the observed outcome. */
export function reliability(items: Array<{ p: number; y: number }>): { ece: number | null; table: ReliabilityBin[] } {
  const bins = Array.from({ length: BINS }, (_, b) => ({ lo: b / BINS, hi: (b + 1) / BINS, n: 0, sumP: 0, sumY: 0 }));
  for (const { p, y } of items) {
    const b = bins[binOf(p)];
    b.n += 1;
    b.sumP += p;
    b.sumY += y;
  }
  const N = items.length;
  const table = bins.map((b) => ({
    range: `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`,
    n: b.n,
    meanP: b.n ? b.sumP / b.n : null,
    freq: b.n ? b.sumY / b.n : null,
    gap: b.n ? b.sumP / b.n - b.sumY / b.n : null,
  }));
  const ece = N ? table.reduce((s, b) => s + (b.n && b.gap !== null ? (b.n / N) * Math.abs(b.gap) : 0), 0) : null;
  return { ece, table };
}

function selective(items: Array<{ conf: number; correct: boolean }>): SelectiveRow[] {
  return TAUS.map((tau) => {
    const acted = items.filter((i) => i.conf >= tau - 1e-12);
    return {
      tau,
      acted: acted.length,
      n: items.length,
      coverage: items.length ? acted.length / items.length : null,
      accuracy: acted.length ? acted.filter((i) => i.correct).length / acted.length : null,
    };
  });
}

/** Binary (noul) measures. qs: { qid, y, p (pTrue, or undefined when unanswered) }. */
export function binaryMeasures(qs: Array<{ qid: string; y: boolean; p: number | undefined }>): GroupMeasures {
  const answered = qs.flatMap((q) => (typeof q.p === 'number' ? [{ y: q.y, p: q.p }] : []));
  const items = answered.map((q) => ({ p: q.p, y: q.y ? 1 : 0 }));
  const right = answered.filter((q) => (q.p >= 0.5) === q.y).length;
  return {
    n: qs.length,
    answered: answered.length,
    missing: qs.length - answered.length,
    right,
    accuracy: qs.length ? right / qs.length : null,
    brier: mean(items.map((i) => (i.p - i.y) ** 2)),
    ...reliability(items),
    selective: selective(answered.map((q) => ({ conf: Math.max(q.p, 1 - q.p), correct: (q.p >= 0.5) === q.y }))),
  };
}

/** Normalise a probs map over its finite, non-negative keys; returns { probs, sum } (sum = the raw total). */
export function normalise(probs: Record<string, number> | undefined): { probs: Record<string, number>; sum: number } {
  const entries = Object.entries(probs ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  return { probs: sum > 0 ? Object.fromEntries(entries.map(([k, v]) => [k, v / sum])) : {}, sum };
}

/** The top option: highest p, ties → the first in the row's option order, off-list keys after. */
export function topOf(probs: Record<string, number>, optionIds: readonly string[]): { id: string; p: number; offList: boolean } | null {
  const order = [...optionIds, ...Object.keys(probs).filter((k) => !optionIds.includes(k))];
  let best: string | null = null;
  for (const k of order) if (probs[k] !== undefined && (best === null || probs[k] > probs[best])) best = k;
  return best === null ? null : { id: best, p: probs[best], offList: !optionIds.includes(best) };
}

/** Choice measures. rows: { id, optionIds, allowed, probs (normalised) | undefined }. */
export function choiceMeasures(
  rows: Array<{ id: string; optionIds: readonly string[]; allowed: readonly string[]; probs: Record<string, number> | undefined }>,
): GroupMeasures {
  const scored = rows.flatMap((r) => {
    const t = r.probs && Object.keys(r.probs).length ? topOf(r.probs, r.optionIds) : null;
    return t && r.probs ? [{ r: { ...r, probs: r.probs }, t, ok: r.allowed.includes(t.id) }] : [];
  });
  const multi = scored.map(({ r }) => {
    const pa = r.allowed.reduce((s, a) => s + (r.probs[a] ?? 0), 0);
    return (pa - 1) ** 2 + Object.entries(r.probs).filter(([k]) => !r.allowed.includes(k)).reduce((s, [, v]) => s + v * v, 0);
  });
  const right = scored.filter((s) => s.ok).length;
  return {
    n: rows.length,
    answered: scored.length,
    missing: rows.length - scored.length,
    right,
    offList: scored.filter((s) => s.t.offList).length,
    accuracy: rows.length ? right / rows.length : null,
    brier: mean(scored.map((s) => (s.t.p - (s.ok ? 1 : 0)) ** 2)),
    brierMulticlass: mean(multi),
    ...reliability(scored.map((s) => ({ p: s.t.p, y: s.ok ? 1 : 0 }))),
    selective: selective(scored.map((s) => ({ conf: s.t.p, correct: s.ok }))),
  };
}

/** Nearest-rank quantile. */
export function quantile(xs: readonly number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
}

/** Per request (by phase) and per question (latencyMs / questions). */
export function latency(requests: readonly BenchmarkRequestRecord[]): LatencySummary {
  const rq = requests.filter((r) => typeof r.latencyMs === 'number');
  const of = (rs: readonly BenchmarkRequestRecord[]): LatencySet => {
    const perQ = rs.map((r) => r.latencyMs / Math.max(1, r.questions ?? 1));
    return {
      n: rs.length,
      p50: quantile(rs.map((r) => r.latencyMs), 0.5),
      p95: quantile(rs.map((r) => r.latencyMs), 0.95),
      perQuestionP50: quantile(perQ, 0.5),
      perQuestionP95: quantile(perQ, 0.95),
    };
  };
  return { all: of(rq), warm: of(rq.filter((r) => r.phase !== 'cold')), cold: rq.filter((r) => r.phase === 'cold').map((r) => r.latencyMs) };
}
