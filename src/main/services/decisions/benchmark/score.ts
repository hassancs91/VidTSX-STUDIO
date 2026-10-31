/**
 * The tree's scorer for the committed decision benchmark (DECISION_MODELS_DESIGN.md §15.1) — D1's `score.cjs` for the two product sets,
 * ported EXACTLY: T2 choice (6 families) and T3 noul, per group (ALL / Arabic / English, and T3's template / caption / clip), over D1's
 * answer files (format "vidtsx-d1-answers/1"). `c2Cells` formats one scored set the way `c-hosted.md` §2 prints its row, so the replay
 * test is a table equality. Pure: no Node, no electron.
 */
import { binaryMeasures, choiceMeasures, latency, normalise } from './measures';
import type { BenchmarkScore, ChoiceAnswerFile, GroupMeasures, NoulAnswerFile, T2Fixture, T2Row, T3Fixture, T3Row } from './types';

type Group<R> = readonly [name: string, keep: (row: R) => boolean];

const T2_GROUPS: ReadonlyArray<Group<T2Row>> = [['ALL', () => true], ['Arabic', (r) => r.arabic], ['English', (r) => !r.arabic]];
const T3_GROUPS: ReadonlyArray<Group<T3Row>> = [
  ['ALL', () => true],
  ['Arabic', (r) => r.arabic],
  ['English', (r) => !r.arabic],
  ...(['template', 'caption', 'clip'] as const).map((k): Group<T3Row> => [k, (r) => r.kind === k]),
];

function grouped<R>(rows: readonly R[], groups: ReadonlyArray<Group<R>>, measure: (rows: R[]) => GroupMeasures) {
  const out: BenchmarkScore['groups'] = {};
  for (const [name, keep] of groups) {
    const kept = rows.filter(keep);
    if (kept.length) out[name] = { rows: kept.length, ...measure(kept) };
  }
  return out;
}

/** T2 (choice): each row's probs renormalised over the keys given; options = the fixture's families; allowed = the row's. */
export function scoreChoiceAnswers(file: ChoiceAnswerFile, fixture: T2Fixture): BenchmarkScore {
  const byId = new Map(file.answers.map((a) => [String(a.id), a]));
  const norm = new Map<string, Record<string, number>>();
  let maxProbSumDeviation = 0;
  for (const row of fixture.rows) {
    const a = byId.get(String(row.id));
    if (!a) continue;
    const n = normalise(a.probs);
    maxProbSumDeviation = Math.max(maxProbSumDeviation, Math.abs(n.sum - 1));
    norm.set(String(row.id), n.probs);
  }
  const groups = grouped(fixture.rows, T2_GROUPS, (rows) =>
    choiceMeasures(rows.map((r) => ({ id: r.id, optionIds: fixture.families, allowed: r.allowed, probs: norm.get(String(r.id)) }))),
  );
  return { task: 't2', mode: 'choice', groups, latency: latency(file.requests), maxProbSumDeviation };
}

/** T3 (noul): pTrue clamped to [0, 1]; the label is the row's `answer`. */
export function scoreNoulAnswers(file: NoulAnswerFile, fixture: T3Fixture): BenchmarkScore {
  const pOf = new Map(file.answers.map((a) => [String(a.qid), typeof a.pTrue === 'number' ? Math.min(1, Math.max(0, a.pTrue)) : undefined]));
  const groups = grouped(fixture.rows, T3_GROUPS, (rows) => binaryMeasures(rows.map((r) => ({ qid: r.id, y: r.answer, p: pOf.get(r.id) }))));
  return { task: 't3', mode: 'noul', groups, latency: latency(file.requests), maxProbSumDeviation: 0 };
}

/** One `c-hosted.md` §2 row's cells (T2 / T3 columns), formatted as D1's score.cjs formats them. */
export interface C2Cells {
  /** `100.0 (40 / 40)` */
  accuracy: string;
  arabic: string;
  /** top-label (choice) / binary (noul), 3 dp */
  brier: string;
  /** choice only — the multiclass note, 3 dp */
  brierMulticlass?: string;
  ece: string;
  /** at τ 0.5 / 0.7 / 0.9: `acc % (cov %)` */
  selective: [string, string, string];
  /** choice: the count; noul: `—` */
  offList: string;
}

const pc = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : (100 * x).toFixed(1));
const f3 = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : x.toFixed(3));
const accuracyCell = (m: GroupMeasures | undefined): string => (m ? `${pc(m.accuracy)} (${m.right} / ${m.n})` : '—');

export function c2Cells(score: BenchmarkScore): C2Cells {
  const all = score.groups.ALL;
  const [s5, s7, s9] = all.selective.map((s) => `${pc(s.accuracy)} (${pc(s.coverage)})`);
  return {
    accuracy: accuracyCell(all),
    arabic: accuracyCell(score.groups.Arabic),
    brier: f3(all.brier),
    ...(score.mode === 'choice' ? { brierMulticlass: f3(all.brierMulticlass) } : {}),
    ece: f3(all.ece),
    selective: [s5, s7, s9],
    offList: score.mode === 'choice' ? String(all.offList ?? 0) : '—',
  };
}
